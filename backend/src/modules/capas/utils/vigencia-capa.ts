import { ConflictException } from '@nestjs/common';

// Vigencia del permiso, no duración máxima de Python/GDAL.
export const VIGENCIA_CAPA_SEGUNDOS = 300;
export const RENOVACION_CAPA_MS = 30_000;

/**
 * Mantiene vivo el permiso mientras se copian/procesan/publican los archivos.
 * Las renovaciones no se solapan. Una renovación incierta pierde el permiso
 * local; PostgreSQL vuelve a comprobar token y vencimiento al publicar.
 *
 * No reemplaza el resultado de una publicación ya confirmada ni oculta
 * ResultadoTransaccionDesconocidoError cuando lo propaga la operación.
 */
export async function conVigenciaCapa<T>(
  renovar: () => Promise<boolean>,
  operacion: (comprobar: () => void) => Promise<T>,
): Promise<T> {
  const fallo = () => new ConflictException('El intento perdió su vigencia de procesamiento.');
  if (!await renovar()) throw fallo();

  let detenido = false;
  let perdido = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let enCurso: Promise<void> | undefined;

  const comprobar = () => {
    if (perdido) throw fallo();
  };
  const programar = () => {
    if (detenido || perdido || temporizador !== undefined || enCurso !== undefined) return;
    temporizador = setTimeout(() => {
      temporizador = undefined;
      if (!detenido) enCurso = pulso();
    }, RENOVACION_CAPA_MS);
    temporizador.unref();
  };
  const pulso = async () => {
    try {
      if (!await renovar()) perdido = true;
    } catch {
      perdido = true;
    } finally {
      enCurso = undefined;
      programar();
    }
  };

  programar();
  try {
    return await operacion(comprobar);
  } finally {
    detenido = true;
    if (temporizador !== undefined) clearTimeout(temporizador);
    // Espera la renovación activa antes de cerrar el pool durante el apagado.
    // pulso contiene sus errores, por lo que no sustituye el resultado principal.
    await enCurso;
  }
}
