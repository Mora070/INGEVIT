import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  getAlmacenamientoLocalConfig,
} from '../../almacenamiento/config/almacenamiento.config';

function esUuid(valor: string): boolean {
  return valor.length === 36
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
}

function noExiste(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ENOENT';
}

/**
 * Rechaza enlaces y comprueba que el directorio físico coincida con
 * la ruta calculada. La raíz debe estar administrada por el servidor.
 */
async function comprobarDirectorio(
  ruta: string,
  admitirAusente: boolean,
): Promise<boolean> {
  try {
    const info = await lstat(ruta);

    if (
      info.isSymbolicLink()
      || !info.isDirectory()
      || relative(ruta, await realpath(ruta)) !== ''
    ) {
      throw new Error('El directorio de teselas no es válido.');
    }

    return true;
  } catch (error: unknown) {
    if (admitirAusente && noExiste(error)) return false;
    throw error;
  }
}

async function comprobarContenido(ruta: string): Promise<void> {
  for (const nombre of await readdir(ruta)) {
    const entrada = join(ruta, nombre);
    const info = await lstat(entrada);

    if (
      info.isSymbolicLink()
      || relative(entrada, await realpath(entrada)) !== ''
    ) {
      throw new Error('La versión contiene un enlace no permitido.');
    }

    if (info.isDirectory()) {
      await comprobarContenido(entrada);
    } else if (!info.isFile()) {
      throw new Error('La versión contiene una entrada no permitida.');
    }
  }
}

/**
 * Borra exclusivamente la versión indicada.
 * No elimina otras versiones ni la carpeta completa de la capa.
 * Una versión ya inexistente se considera limpiada.
 */
export async function eliminarVersionTeselas(
  capa: string,
  version: string,
): Promise<void> {
  if (!esUuid(capa) || !esUuid(version)) {
    throw new Error('Los identificadores de limpieza no son válidos.');
  }

  let ruta = getAlmacenamientoLocalConfig().directorioRaiz;

  await comprobarDirectorio(ruta, false);

  for (const parte of ['capas-teselas', capa, version]) {
    ruta = join(ruta, parte);

    if (!await comprobarDirectorio(ruta, true)) {
      return;
    }
  }

  // La ruta absoluta y su contenido se validan antes del borrado recursivo.
  await comprobarContenido(ruta);
  await rm(ruta, { recursive: true, force: true });
}