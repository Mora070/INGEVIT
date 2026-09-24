import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';

type TipoTemporal = 'original' | 'teselas';

/**
 * Identifica esta ejecución de Node.
 *
 * Se comparte entre sus temporales y cambia al reiniciar el proceso.
 * El PID es informativo: puede reutilizarse y no demuestra actividad.
 */
const ejecucion = Object.freeze({
  id: randomUUID(),
  pid: process.pid,
  equipo: hostname(),
  registroInicial: new Date().toISOString(),
});

/**
 * Comprueba si dos ubicaciones coinciden o una contiene a la otra.
 * Evita mezclar temporales con almacenamiento persistente.
 */
function contiene(raiz: string, destino: string): boolean {
  const diferencia = relative(raiz, destino);

  return diferencia === ''
    || (
      diferencia !== '..'
      && !diferencia.startsWith(`..${sep}`)
      && !isAbsolute(diferencia)
    );
}

function validarRuta(valor: string): string {
  if (
    !valor
    || valor !== valor.trim()
    || /[\0\r\n]/.test(valor)
    || !isAbsolute(valor)
  ) {
    throw new Error(
      'La raíz temporal de capas debe ser una ruta absoluta válida.',
    );
  }

  const ruta = resolve(valor);

  if (ruta === parse(ruta).root) {
    throw new Error(
      'La raíz temporal de capas no puede ser la raíz de una unidad.',
    );
  }

  return ruta;
}

/**
 * Resuelve la configuración sin crear carpetas.
 * El valor predeterminado utiliza una carpeta exclusiva para capas.
 */
export function getRaizTemporalCapas(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raiz = validarRuta(
    env.CAPAS_TEMP_ROOT ?? join(tmpdir(), 'ingevit-capas'),
  );

  if (env.STORAGE_LOCAL_ROOT) {
    const almacenamiento = validarRuta(env.STORAGE_LOCAL_ROOT);

    if (
      contiene(almacenamiento, raiz)
      || contiene(raiz, almacenamiento)
    ) {
      throw new Error(
        'CAPAS_TEMP_ROOT y STORAGE_LOCAL_ROOT deben estar separados.',
      );
    }
  }

  return raiz;
}

/**
 * Crea los componentes necesarios y rechaza enlaces simbólicos
 * o junctions existentes en la ruta.
 *
 * Estas carpetas deben permanecer bajo control del servidor.
 */
async function prepararDirectorio(ruta: string): Promise<void> {
  const padre = dirname(ruta);

  if (padre !== ruta) {
    await prepararDirectorio(padre);

    try {
      await mkdir(ruta, { mode: 0o700 });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  const informacion = await lstat(ruta);

  if (
    informacion.isSymbolicLink()
    || !informacion.isDirectory()
  ) {
    throw new Error(
      'La ruta temporal de capas debe contener únicamente directorios reales.',
    );
  }
}

/**
 * Reserva una carpeta exclusiva para una operación.
 *
 * La raíz explícita permite aislar las pruebas. Nunca debe proceder
 * de parámetros enviados por el usuario.
 *
 * Quien utiliza esta función elimina solamente la carpeta devuelta,
 * después de finalizar todas sus lecturas y escrituras.
 */
export async function crearTemporalCapa(
  tipo: TipoTemporal,
  raizExplicita?: string,
): Promise<string> {
  const raiz = raizExplicita === undefined
    ? getRaizTemporalCapas()
    : validarRuta(raizExplicita);

  await prepararDirectorio(raiz);

  const directorio = await mkdtemp(join(raiz, `${tipo}-`));

try {
  const registro = {
    version: 1,
    idTemporal: randomUUID(),
    tipo,
    fechaCreacion: new Date().toISOString(),
    ejecucion,
  };

  await writeFile(
    join(directorio, 'temporal.json'),
    JSON.stringify(registro, null, 2),
    {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    },
  );

  return directorio;
} catch (error: unknown) {
  // La carpeta todavía no se ha entregado a ningún consumidor.
  await rm(directorio, { recursive: true, force: true });
  throw error;
}
}