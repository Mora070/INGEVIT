import { UnprocessableEntityException } from '@nestjs/common';

import { ejecutarGdalInfo } from './ejecutar-gdalinfo';

export interface MetadatosGeoTiff {
  ancho: number;
  alto: number;
  crsOriginal: string;
  bbox: [number, number, number, number];
}

function esObjeto(
  valor: unknown,
): valor is Record<string, unknown> {
  return (
    typeof valor === 'object'
    && valor !== null
    && !Array.isArray(valor)
  );
}

function rechazar(mensaje: string): never {
  throw new UnprocessableEntityException(mensaje);
}

/**
 * Interpreta exclusivamente la salida interna de gdalinfo.
 * Nunca debe recibir metadatos declarados por el formulario.
 *
 * Exige una transformación afín: los archivos georreferenciados
 * únicamente mediante GCP o RPC necesitarían otro procesamiento.
 *
 * Esta inspección no lee ni verifica todos los píxeles del raster.
 */
export function validarMetadatosGeoTiff(
  informacion: unknown,
): MetadatosGeoTiff {
  if (
    !esObjeto(informacion)
    || informacion.driverShortName !== 'GTiff'
  ) {
    rechazar('El archivo debe ser un TIFF compatible con GDAL.');
  }

  const dimensiones = informacion.size;

  if (
    !Array.isArray(dimensiones)
    || dimensiones.length !== 2
    || !dimensiones.every(
      (valor) =>
        typeof valor === 'number'
        && Number.isInteger(valor)
        && valor > 0
        && valor <= 2147483647,
    )
  ) {
    rechazar('El GeoTIFF contiene dimensiones inválidas.');
  }

  const sistema = informacion.coordinateSystem;

  if (
    !esObjeto(sistema)
    || typeof sistema.wkt !== 'string'
    || sistema.wkt.trim() === ''
    || sistema.wkt.includes('\0')
  ) {
    rechazar('El GeoTIFF debe contener un sistema de coordenadas.');
  }

  const transformacion = informacion.geoTransform;

  if (
    !Array.isArray(transformacion)
    || transformacion.length !== 6
    || !transformacion.every(
      (valor) =>
        typeof valor === 'number'
        && Number.isFinite(valor),
    )
  ) {
    rechazar('El GeoTIFF no contiene una transformación geográfica válida.');
  }

  /*
   * Permite rasters rotados.
   * El determinante debe ser distinto de cero para que la transformación
   * represente un área y pueda invertirse.
   */
  const determinante =
    transformacion[1] * transformacion[5]
    - transformacion[2] * transformacion[4];

  if (!Number.isFinite(determinante) || determinante === 0) {
    rechazar('La transformación geográfica del GeoTIFF es degenerada.');
  }

  const extension = informacion.wgs84Extent;

  if (
    !esObjeto(extension)
    || extension.type !== 'Polygon'
    || !Array.isArray(extension.coordinates)
    || extension.coordinates.length !== 1
  ) {
    rechazar('No se pudo obtener una extensión geográfica WGS84 válida.');
  }

  const anillo = extension.coordinates[0];

  if (!Array.isArray(anillo) || anillo.length < 4) {
    rechazar('La extensión geográfica del GeoTIFF está incompleta.');
  }

  const puntos: Array<[number, number]> = [];

  for (const punto of anillo) {
    if (
      !Array.isArray(punto)
      || punto.length !== 2
      || typeof punto[0] !== 'number'
      || typeof punto[1] !== 'number'
      || !Number.isFinite(punto[0])
      || !Number.isFinite(punto[1])
      || punto[0] < -180
      || punto[0] > 180
      || punto[1] < -90
      || punto[1] > 90
    ) {
      rechazar('El GeoTIFF contiene coordenadas WGS84 inválidas.');
    }

    puntos.push([punto[0], punto[1]]);
  }

  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    rechazar('La extensión geográfica del GeoTIFF no está cerrada.');
  }

  let oeste = primero[0];
  let sur = primero[1];
  let este = primero[0];
  let norte = primero[1];
  let dobleArea = 0;

  for (let indice = 1; indice < puntos.length; indice += 1) {
    const anterior = puntos[indice - 1];
    const actual = puntos[indice];

    if (Math.abs(actual[0] - anterior[0]) > 180) {
      rechazar(
        'Por ahora no se admiten GeoTIFF que crucen el antimeridiano.',
      );
    }

    oeste = Math.min(oeste, actual[0]);
    sur = Math.min(sur, actual[1]);
    este = Math.max(este, actual[0]);
    norte = Math.max(norte, actual[1]);

    // Coordenadas relativas para reducir la pérdida de precisión.
    dobleArea +=
      (anterior[0] - primero[0]) * (actual[1] - primero[1])
      - (actual[0] - primero[0]) * (anterior[1] - primero[1]);
  }

  if (oeste >= este || sur >= norte || dobleArea === 0) {
    rechazar('La extensión geográfica del GeoTIFF no representa un área.');
  }

  return {
    ancho: dimensiones[0],
    alto: dimensiones[1],
    crsOriginal: sistema.wkt,
    bbox: [oeste, sur, este, norte],
  };
}

/**
 * Punto de entrada para el servicio de subida.
 * Debe ejecutarse mientras el archivo temporal siga disponible.
 */
export async function inspeccionarGeoTiff(
  rutaTemporal: string,
): Promise<MetadatosGeoTiff> {
  const informacion = await ejecutarGdalInfo(rutaTemporal);
  return validarMetadatosGeoTiff(informacion);
}