"""Genera PNG XYZ provisionales. NestJS conserva la publicación y los permisos."""
import argparse
import json
import math
import sys
import time
from contextlib import ExitStack
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import ColorInterp, Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds, calculate_default_transform
from rasterio.windows import Window

MERCATOR = 20037508.342789244
LIMIT = math.degrees(math.atan(math.sinh(math.pi)))


def memoria():
    """Linux: RSS y máximo del proceso; no confundir con memoria del contenedor."""
    try:
        valores = {}
        for linea in Path('/proc/self/status').read_text().splitlines():
            clave, _, valor = linea.partition(':')
            if clave in ('VmRSS', 'VmHWM'):
                valores[clave] = int(valor.split()[0]) * 1024
        return dict(rss_bytes=valores.get('VmRSS'), pico_rss_bytes=valores.get('VmHWM'))
    except (OSError, ValueError):
        if sys.platform == 'win32':
            import ctypes
            from ctypes import wintypes

            class Contadores(ctypes.Structure):
                _fields_ = [('cb', wintypes.DWORD), ('fallos', wintypes.DWORD)] + [
                    (nombre, ctypes.c_size_t) for nombre in (
                        'pico', 'actual', 'pool_pico', 'pool', 'no_pool_pico',
                        'no_pool', 'pagefile', 'pagefile_pico')]

            datos = Contadores()
            datos.cb = ctypes.sizeof(datos)
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel.GetCurrentProcess.restype = wintypes.HANDLE
            psapi = ctypes.WinDLL('psapi', use_last_error=True)
            psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE,
                                                  ctypes.POINTER(Contadores), wintypes.DWORD]
            if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(datos), datos.cb):
                return dict(rss_bytes=datos.actual, pico_rss_bytes=datos.pico)
        return dict(rss_bytes=None, pico_rss_bytes=None)


def overview_para_zoom(src, bands, alpha, zoom):
    """Usa pirámides internas al menos dos veces más finas que el destino.

    Abrir explícitamente la pirámide evita depender de que el warp seleccione
    overviews de la fuente. Nunca lee la imagen completa en un ndarray.
    """
    transform, _, _ = calculate_default_transform(
        src.crs, 'EPSG:3857', src.width, src.height, *src.bounds)
    resolucion = max(abs(transform.a), abs(transform.e))
    factor_max = (2 * MERCATOR / (256 * 2 ** zoom)) / (2 * resolucion)
    indices = set(bands + ((alpha,) if alpha else ()))
    comunes = set.intersection(*(set(src.overviews(b)) for b in indices))
    candidatos = [f for f in comunes if 1 < f <= factor_max]
    if not candidatos:
        return None
    factor = max(candidatos)
    # GDAL OVERVIEW_LEVEL es un índice, no el factor de reducción.
    nivel = src.overviews(1).index(factor) if factor in src.overviews(1) else None
    if nivel is None or any(src.overviews(b).index(factor) != nivel for b in indices):
        return None
    return nivel


class Rechazo(ValueError):
    def __init__(self, codigo, mensaje):
        super().__init__(mensaje)
        self.codigo = codigo


def rango(bounds, zoom):
    west, south, east, north = bounds
    n = 2 ** zoom
    def x(lon):
        return (lon + 180) / 360 * n
    def y(lat):
        return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    def limitar(v):
        return max(0, min(n - 1, v))
    return (limitar(math.floor(x(west))), limitar(math.floor(y(north))),
            limitar(math.ceil(x(east)) - 1), limitar(math.ceil(y(south)) - 1))


def transformacion(x, y, z):
    lado = 2 * MERCATOR / 2 ** z
    left, top = -MERCATOR + x * lado, MERCATOR - y * lado
    return from_bounds(left, top - lado, left + lado, top, 256, 256)


def preparar(src, minzoom, maxzoom, max_tiles):
    if src.driver != 'GTiff' or not src.crs:
        raise Rechazo('FORMATO', 'Se requiere un GeoTIFF con CRS.')
    t = src.transform
    if (t.is_identity or not all(math.isfinite(v) for v in t)
            or t.a * t.e - t.b * t.d == 0 or src.gcps[0] or src.rpcs):
        raise Rechazo('GEOREFERENCIA', 'Se requiere una ortofoto con transformación afín válida.')
    colores = src.colorinterp
    rgb = (ColorInterp.red, ColorInterp.green, ColorInterp.blue)
    if all(c in colores for c in rgb):
        bands = tuple(colores.index(c) + 1 for c in rgb)
    elif ColorInterp.gray in colores:
        bands = (colores.index(ColorInterp.gray) + 1,) * 3
    else:
        raise Rechazo('BANDAS', 'No se identificaron bandas RGB ni escala de grises.')
    alpha = colores.index(ColorInterp.alpha) + 1 if ColorInterp.alpha in colores else None
    seleccion = bands + ((alpha,) if alpha is not None else ())
    if any(src.dtypes[b - 1] != 'uint8' for b in seleccion):
        raise Rechazo('TIPO_DATO', 'Esta versión requiere bandas Byte/uint8; no aplica escalado radiométrico implícito.')
    bounds = transform_bounds(src.crs, 'EPSG:4326', *src.bounds, densify_pts=41)
    west, south, east, north = bounds
    if not (all(math.isfinite(v) for v in bounds)
            and -180 <= west < east <= 180 and -LIMIT <= south < north <= LIMIT):
        raise Rechazo('EXTENSION', 'La extensión no es compatible con esta generación Web Mercator.')
    ranges = []
    total = 0
    for z in range(minzoom, maxzoom + 1):
        limites = rango(bounds, z)
        x0, y0, x1, y1 = limites
        cantidad = (x1 - x0 + 1) * (y1 - y0 + 1)
        if cantidad <= 0:
            raise Rechazo('EXTENSION', 'La extensión no produce teselas válidas.')
        if total + cantidad > max_tiles:
            break
        ranges.append((z, limites))
        total += cantidad
    if not ranges:
        raise Rechazo('LIMITE_TESELAS',
                      'Incluso el zoom mínimo supera el presupuesto de teselas.')
    return bands, alpha, bounds, ranges, total


def procesar(source, output, minzoom=12, maxzoom=22, max_tiles=10000,
             max_bytes=10737418240, cache_mb=128, warp_mb=32, inspect_only=False):
    if not 0 <= minzoom <= maxzoom <= 24:
        raise Rechazo('CONFIGURACION', 'Los zoom deben cumplir 0 <= mínimo <= máximo <= 24.')
    if min(max_tiles, max_bytes, cache_mb, warp_mb) <= 0:
        raise Rechazo('CONFIGURACION', 'Los presupuestos deben ser positivos.')
    source = Path(source).resolve(strict=True)
    output = Path(output).resolve()
    if not source.is_file() or output == source or output in source.parents:
        raise Rechazo('RUTA', 'Las rutas de entrada y salida no son válidas.')
    if output.exists():
        raise Rechazo('RUTA', 'La salida debe ser una carpeta nueva.')

    # Estos son presupuestos de caché y reproyección, no un límite de RAM
    # total del proceso. La lectura física depende de los bloques del TIFF.
    inicio = time.monotonic()
    with rasterio.Env(GDAL_CACHEMAX=cache_mb * 1024 * 1024,
                      GDAL_PAM_ENABLED='NO', PROJ_NETWORK='OFF',
                      GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_NUM_THREADS='1'):
        with rasterio.open(source, driver='GTiff', GEOREF_SOURCES='INTERNAL') as src:
            bands, alpha_index, bounds, ranges, total = preparar(src, minzoom, maxzoom, max_tiles)
            zoom_solicitado = maxzoom
            maxzoom = ranges[-1][0]
            plan = dict(evento='plan', ancho=src.width, alto=src.height,
                        bbox=list(bounds), zoom_min=minzoom, zoom_max=maxzoom,
                        zoom_max_solicitado=zoom_solicitado,
                        total=total, bandas=list(bands), gdal=rasterio.__gdal_version__,
                        cache_mb=cache_mb, warp_mb=warp_mb, **memoria())
            print(json.dumps(plan), flush=True)
            if inspect_only:
                return plan
            output.mkdir(parents=True, exist_ok=False)
            cantidad = 0
            bytes_total = 0
            for z, (x0, y0, x1, y1) in ranges:
                with ExitStack() as stack:
                    nivel = overview_para_zoom(src, bands, alpha_index, z)
                    fuente = src if nivel is None else stack.enter_context(rasterio.open(
                        source, driver='GTiff', GEOREF_SOURCES='INTERNAL', overview_level=nivel))
                    # VRT virtual por zoom, alineado a XYZ. Solo se leen ventanas
                    # de 256x256; sus dimensiones no reservan el raster completo.
                    vrt = stack.enter_context(WarpedVRT(
                        fuente, crs='EPSG:3857', transform=transformacion(x0, y0, z),
                        width=(x1 - x0 + 1) * 256, height=(y1 - y0 + 1) * 256,
                        resampling=Resampling.bilinear, warp_mem_limit=warp_mb,
                        add_alpha=alpha_index is None))
                    seleccion = bands + (alpha_index if alpha_index is not None else vrt.count,)
                    print(json.dumps(dict(evento='zoom', zoom=z, overview=nivel,
                                          ancho_fuente=fuente.width, alto_fuente=fuente.height,
                                          **memoria())), flush=True)
                    for x in range(x0, x1 + 1):
                        carpeta = output / str(z) / str(x)
                        carpeta.mkdir(parents=True, exist_ok=True)
                        for y in range(y0, y1 + 1):
                            datos = vrt.read(seleccion, window=Window(
                                (x - x0) * 256, (y - y0) * 256, 256, 256))
                            destino = carpeta / f'{y}.png'
                            with Image.fromarray(np.moveaxis(datos, 0, -1)) as imagen:
                                imagen.save(destino, format='PNG')
                            bytes_total += destino.stat().st_size
                            cantidad += 1
                            if bytes_total > max_bytes:
                                raise Rechazo('LIMITE_DISCO', 'Las teselas superaron el presupuesto de bytes.')
                            if cantidad == 1 or cantidad % 100 == 0:
                                print(json.dumps(dict(evento='memoria', zoom=z, total=cantidad,
                                                      **memoria())), flush=True)
                print(json.dumps(dict(evento='avance', zoom=z, total=cantidad,
                                      **memoria())), flush=True)
            resultado = dict(evento='terminado', total=cantidad, bytes=bytes_total,
                             segundos=round(time.monotonic() - inicio, 3), **memoria())
            print(json.dumps(resultado), flush=True)
            return resultado


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--minzoom', type=int, default=12)
    parser.add_argument('--maxzoom', type=int, default=22)
    parser.add_argument('--max-tiles', type=int, default=10000)
    parser.add_argument('--max-bytes', type=int, default=10737418240)
    parser.add_argument('--cache-mb', type=int, default=128)
    parser.add_argument('--warp-mb', type=int, default=32)
    parser.add_argument('--inspect-only', action='store_true')
    args = parser.parse_args()
    try:
        procesar(args.input, args.output, args.minzoom, args.maxzoom,
                 args.max_tiles, args.max_bytes, args.cache_mb, args.warp_mb,
                 args.inspect_only)
    except Rechazo as error:
        print(json.dumps(dict(codigo=error.codigo, mensaje=str(error))), file=sys.stderr)
        return 2
    except Exception:
        # No imprime rutas o detalles internos al proceso consumidor.
        print(json.dumps(dict(codigo='PROCESAMIENTO', mensaje='No se pudo procesar el GeoTIFF.')), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
