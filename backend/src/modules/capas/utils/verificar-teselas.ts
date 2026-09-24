import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import type { TeselasConfig } from '../config/teselas.config';

export interface TeselaVerificada {
  z: number;
  x: number;
  y: number;
  ruta: string;
}

/**
 * Comprueba estructura XYZ, cantidad y decodificación de los PNG.
 *
 * Devuelve únicamente imágenes verificadas.
 * Los archivos auxiliares de GDAL no forman parte de la publicación.
 */
export async function verificarTeselas(
  directorio: string,
  config: Pick<TeselasConfig, 'zoomMin' | 'zoomMax' | 'maxArchivos'>,
): Promise<TeselaVerificada[]> {
  await exigirDirectorio(directorio);

  const resultado: TeselaVerificada[] = [];
  const niveles = new Set<number>();

  for (const nombreZoom of await readdir(directorio)) {
    const rutaZoom = join(directorio, nombreZoom);

    // GDAL puede escribir este descriptor aunque no genere un visor.
    if (nombreZoom === 'tilemapresource.xml') {
      const info = await lstat(rutaZoom);
      if (info.isSymbolicLink() || !info.isFile()) {
        throw new Error('El descriptor de teselas no es un archivo regular.');
      }
      continue;
    }

    const z = indice(nombreZoom);

    if (z < config.zoomMin || z > config.zoomMax) {
      throw new Error('La generación contiene un zoom no solicitado.');
    }

    await exigirDirectorio(rutaZoom);
    const lado = 2 ** z;

    for (const nombreX of await readdir(rutaZoom)) {
      const x = indice(nombreX);

      if (x >= lado) {
        throw new Error('La generación contiene una coordenada X inválida.');
      }

      const rutaX = join(rutaZoom, nombreX);
      await exigirDirectorio(rutaX);

      for (const nombreArchivo of await readdir(rutaX)) {
        if (!/^(0|[1-9][0-9]*)\.png$/.test(nombreArchivo)) {
          throw new Error('La generación contiene un archivo inesperado.');
        }

        const y = indice(nombreArchivo.slice(0, -4));

        if (y >= lado) {
          throw new Error('La generación contiene una coordenada Y inválida.');
        }

        if (resultado.length >= config.maxArchivos) {
          throw new Error('La generación supera el máximo de teselas.');
        }

        const ruta = join(rutaX, nombreArchivo);
        const info = await lstat(ruta);

        if (info.isSymbolicLink() || !info.isFile()) {
          throw new Error('La tesela no es un archivo regular.');
        }

        const imagen = sharp(ruta, {
          limitInputPixels: 256 * 256,
          failOn: 'warning',
        });

        const metadata = await imagen.metadata();

        if (
          metadata.format !== 'png'
          || metadata.width !== 256
          || metadata.height !== 256
          || (metadata.pages ?? 1) !== 1
        ) {
          throw new Error('La tesela no es un PNG estático de 256 por 256.');
        }

        // Fuerza la lectura de los píxeles, no solo de la cabecera.
        await imagen.stats();

        resultado.push({ z, x, y, ruta });
        niveles.add(z);
      }
    }
  }

  for (let z = config.zoomMin; z <= config.zoomMax; z += 1) {
    if (!niveles.has(z)) {
      throw new Error('La generación no contiene todos los niveles solicitados.');
    }
  }

  return resultado;
}

function indice(valor: string): number {
  if (
    valor !== valor.trim()
    || !/^(0|[1-9][0-9]*)$/.test(valor)
    || !Number.isSafeInteger(Number(valor))
  ) {
    throw new Error('La generación contiene un índice inválido.');
  }

  return Number(valor);
}

async function exigirDirectorio(ruta: string): Promise<void> {
  const info = await lstat(ruta);

  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error('La generación contiene un directorio inválido.');
  }
}