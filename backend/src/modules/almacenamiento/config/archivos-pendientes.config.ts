export interface ArchivosPendientesConfig {
  habilitado: boolean;
  intervaloMs: number;
  demoraReintentoSegundos: number;
  maxTareasPorCiclo: number;
}

/**
 * Lee un entero positivo dentro de límites técnicos.
 *
 * Rechaza decimales, signos, espacios y valores fuera del rango.
 * Una variable ausente utiliza el valor predeterminado.
 */
function leerEntero(
  env: NodeJS.ProcessEnv,
  nombre: string,
  predeterminado: number,
  minimo: number,
  maximo: number,
): number {
  const texto = env[nombre];

  if (texto === undefined) {
    return predeterminado;
  }

  if (!/^[0-9]+$/.test(texto) || texto.includes('\n')) {
    throw new Error(
      `${nombre} debe ser un entero entre ${minimo} y ${maximo}.`,
    );
  }

  const valor = Number(texto);

  if (
    !Number.isSafeInteger(valor) ||
    valor < minimo ||
    valor > maximo
  ) {
    throw new Error(
      `${nombre} debe ser un entero entre ${minimo} y ${maximo}.`,
    );
  }

  return valor;
}

/**
 * Configura el procesamiento automático de archivos pendientes.
 *
 * No inicia temporizadores ni consulta PostgreSQL.
 * Rechaza configuraciones inválidas, incluso estando desactivado,
 * para detectar errores antes de habilitar el trabajador.
 */
export function getArchivosPendientesConfig(
  env: NodeJS.ProcessEnv = process.env,
): ArchivosPendientesConfig {
  const habilitado = env.ARCHIVOS_PENDIENTES_HABILITADO;

  if (
    habilitado !== undefined &&
    habilitado !== 'true' &&
    habilitado !== 'false'
  ) {
    throw new Error(
      'ARCHIVOS_PENDIENTES_HABILITADO debe ser true o false.',
    );
  }

  return {
    habilitado: habilitado === 'true',

    intervaloMs: leerEntero(
      env,
      'ARCHIVOS_PENDIENTES_INTERVALO_MS',
      5000,
      1000,
      300000,
    ),

    demoraReintentoSegundos: leerEntero(
      env,
      'ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS',
      60,
      1,
      86400,
    ),

    maxTareasPorCiclo: leerEntero(
      env,
      'ARCHIVOS_PENDIENTES_MAX_TAREAS',
      10,
      1,
      100,
    ),
  };
}