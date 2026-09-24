"""Genera PNG XYZ provisionales. NestJS conserva la publicación y los permisos."""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import ColorInterp, Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds

MERCATOR = 20037508.342789244
LIMIT = math.degrees(math.atan(math.sinh(math.pi)))


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
    ranges = [(z, rango(bounds, z)) for z in range(minzoom, maxzoom + 1)]
    total = sum((x1 - x0 + 1) * (y1 - y0 + 1) for _, (x0, y0, x1, y1) in ranges)
    if total <= 0 or total > max_tiles:
        raise Rechazo('LIMITE_TESELAS', f'Se requieren {total} teselas; el límite configurado es {max_tiles}.')
    return bands, alpha, bounds, ranges, total


def procesar(source, output, minzoom=12, maxzoom=22, max_tiles=10000,
             max_bytes=10737418240, cache_mb=256, warp_mb=64, inspect_only=False):
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
    with rasterio.Env(GDAL_CACHEMAX=cache_mb * 1024 * 1024,
                      GDAL_PAM_ENABLED='NO', PROJ_NETWORK='OFF',
                      GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_NUM_THREADS='1'):
        with rasterio.open(source, driver='GTiff', GEOREF_SOURCES='INTERNAL') as src:
            bands, alpha_index, bounds, ranges, total = preparar(src, minzoom, maxzoom, max_tiles)
            plan = dict(evento='plan', ancho=src.width, alto=src.height,
                        bbox=list(bounds), zoom_min=minzoom, zoom_max=maxzoom,
                        total=total, bandas=list(bands), gdal=rasterio.__gdal_version__)
            print(json.dumps(plan), flush=True)
            if inspect_only:
                return plan
            output.mkdir(parents=True, exist_ok=False)
            cantidad = 0
            bytes_total = 0
            for z, (x0, y0, x1, y1) in ranges:
                for x in range(x0, x1 + 1):
                    carpeta = output / str(z) / str(x)
                    carpeta.mkdir(parents=True, exist_ok=True)
                    for y in range(y0, y1 + 1):
                        # Cada VRT representa exactamente una tesela XYZ.
                        # No se crea un raster reproyectado del tamaño total.
                        with WarpedVRT(src, crs='EPSG:3857',
                                       transform=transformacion(x, y, z),
                                       width=256, height=256,
                                       resampling=Resampling.bilinear,
                                       warp_mem_limit=warp_mb,
                                       add_alpha=alpha_index is None) as vrt:
                            colors = vrt.read(bands)
                            alpha = vrt.read(alpha_index if alpha_index is not None else vrt.count)
                            rgba = np.concatenate((colors, alpha[np.newaxis]), axis=0)
                            rgba = np.moveaxis(rgba, 0, -1)
                            destino = carpeta / f'{y}.png'
                            Image.fromarray(rgba).save(destino, format='PNG')
                        bytes_total += destino.stat().st_size
                        cantidad += 1
                        # La escritura que rebasa el presupuesto permanece
                        # provisional y NestJS elimina todo el intento fallido.
                        if bytes_total > max_bytes:
                            raise Rechazo('LIMITE_DISCO', 'Las teselas superaron el presupuesto de bytes.')
                print(json.dumps(dict(evento='avance', zoom=z, total=cantidad)), flush=True)
            resultado = dict(evento='terminado', total=cantidad, bytes=bytes_total)
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
    parser.add_argument('--cache-mb', type=int, default=256)
    parser.add_argument('--warp-mb', type=int, default=64)
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
