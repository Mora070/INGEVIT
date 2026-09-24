import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  getAlmacenamientoLocalConfig,
} from '../../almacenamiento/config/almacenamiento.config';
import {
  prepararRaizAlmacenamiento,
} from '../../almacenamiento/utils/preparar-raiz-almacenamiento';
import {
  ResultadoTransaccionDesconocidoError,
} from '../../../database/errors/resultado-transaccion-desconocido.error';
import type { GeneracionTeselas } from './generar-teselas';
import { verificarTeselas } from './verificar-teselas';

export interface PublicacionTeselas {
  version: string;
  proveedor: 'LOCAL';
  zoomMin: number;
  zoomMax: number;
  tamano: 256;
  total: string;
}

/**
 * Publica una colección local y permite registrar su referencia.
 *
 * registrar debe confirmar su transacción antes de devolver el resultado.
 * Si esa transacción tiene resultado incierto, debe propagar
 * ResultadoTransaccionDesconocidoError.
 *
 * No modifica ni elimina el GeoTIFF original.
 * La carpeta base se crea bajo la raíz de almacenamiento configurada.
 */
export async function publicarTeselasLocales<T>(
  idCapa: string,
  generacion: GeneracionTeselas,
  registrar: (publicacion: PublicacionTeselas) => Promise<T>,
  raizConfigurada = getAlmacenamientoLocalConfig().directorioRaiz,
): Promise<T> {
  if (
    typeof idCapa !== 'string'
    || idCapa.length !== 36
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(idCapa)
  ) {
    throw new Error('El identificador de la capa no es válido.');
  }

  if (
    !Number.isInteger(generacion.zoomMin)
    || !Number.isInteger(generacion.zoomMax)
    || generacion.zoomMin < 0
    || generacion.zoomMax > 30
    || generacion.zoomMin > generacion.zoomMax
    || generacion.tamano !== 256
    || !Number.isSafeInteger(generacion.total)
    || generacion.total <= 0
    || generacion.total !== generacion.teselas.length
  ) {
    throw new Error('Los datos de la generación no son válidos.');
  }

  const raiz = await prepararRaizAlmacenamiento(raizConfigurada);
  const categoria = join(raiz, 'capas-teselas');
  await prepararDirectorio(categoria);

  const directorioCapa = join(categoria, idCapa);
  await prepararDirectorio(directorioCapa);

  const version = randomUUID();
  const directorioVersion = join(directorioCapa, version);

  /*
   * Sin recursive: si la versión ya existiera, se rechaza.
   * Solo compensamos después de crear nuestra propia carpeta.
   */
  await mkdir(directorioVersion);

  let publicada = false;

  try {
    const provisional = join(directorioVersion, '_provisional');
    await mkdir(provisional);

    for (const tesela of generacion.teselas) {
      if (
        !Number.isInteger(tesela.z)
        || tesela.z < generacion.zoomMin
        || tesela.z > generacion.zoomMax
        || !Number.isInteger(tesela.x)
        || !Number.isInteger(tesela.y)
        || tesela.x < 0
        || tesela.y < 0
        || tesela.x >= 2 ** tesela.z
        || tesela.y >= 2 ** tesela.z
      ) {
        throw new Error('La colección contiene coordenadas XYZ inválidas.');
      }

      const origen = await lstat(tesela.ruta);

      if (origen.isSymbolicLink() || !origen.isFile()) {
        throw new Error('La tesela de origen no es un archivo regular.');
      }

      const carpeta = join(
        provisional,
        String(tesela.z),
        String(tesela.x),
      );

      // Solo crea subdirectorios numéricos dentro de nuestra versión exclusiva.
      await mkdir(carpeta, { recursive: true });

      await copyFile(
        tesela.ruta,
        join(carpeta, `${tesela.y}.png`),
        constants.COPYFILE_EXCL,
      );
    }

    const verificadas = await verificarTeselas(provisional, {
      zoomMin: generacion.zoomMin,
      zoomMax: generacion.zoomMax,
      maxArchivos: generacion.total,
    });

    if (verificadas.length !== generacion.total) {
      throw new Error('La cantidad de teselas publicadas no coincide.');
    }

    /*
     * Ambas carpetas están en el mismo almacenamiento.
     * La carpeta final no existe previamente dentro de esta versión.
     */
    await rename(provisional, join(directorioVersion, 'tiles'));
    publicada = true;

    return await registrar({
      version,
      proveedor: 'LOCAL',
      zoomMin: generacion.zoomMin,
      zoomMax: generacion.zoomMax,
      tamano: 256,
      total: String(verificadas.length),
    });
  } catch (error: unknown) {
    if (
      publicada
      && error instanceof ResultadoTransaccionDesconocidoError
    ) {
      // La colección podría estar referenciada por una transacción confirmada.
      throw error;
    }

    try {
      await rm(directorioVersion, { recursive: true, force: true });
    } catch (errorLimpieza: unknown) {
      throw new AggregateError(
        [error, errorLimpieza],
        'Falló la publicación de teselas y no pudo limpiarse su versión.',
      );
    }

    throw error;
  }
}

/**
 * No admite archivos, enlaces simbólicos ni uniones de directorios.
 * Las carpetas superiores deben estar administradas por el servidor.
 */
async function prepararDirectorio(ruta: string): Promise<void> {
  try {
    await mkdir(ruta);
  } catch (error: unknown) {
    if (
      typeof error !== 'object'
      || error === null
      || !('code' in error)
      || error.code !== 'EEXIST'
    ) {
      throw error;
    }
  }

  const info = await lstat(ruta);

  if (
    info.isSymbolicLink()
    || !info.isDirectory()
    || relative(ruta, await realpath(ruta)) !== ''
  ) {
    throw new Error('El directorio de publicación no es válido.');
  }
}