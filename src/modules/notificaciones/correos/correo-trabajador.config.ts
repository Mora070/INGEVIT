export interface CorreoTrabajadorConfig {
  habilitado: boolean;
  intervaloMs: number;
  maxPorCiclo: number;
}

/**
 * Configura la frecuencia y el límite de trabajo por ciclo.
 *
 * El trabajador permanece deshabilitado si no se indica explícitamente
 * "true". Los valores incorrectos producen un error de configuración.
 */
export function getCorreoTrabajadorConfig(
  env: NodeJS.ProcessEnv = process.env,
): CorreoTrabajadorConfig {
  const habilitado = env.CORREO_TRABAJADOR_HABILITADO ?? 'false';

  if (habilitado !== 'true' && habilitado !== 'false') {
    throw new Error(
      'CORREO_TRABAJADOR_HABILITADO debe ser true o false.',
    );
  }

  return {
    habilitado: habilitado === 'true',
    intervaloMs: leerEntero(
      env.CORREO_TRABAJADOR_INTERVALO_MS,
      5_000,
      1_000,
      300_000,
      'CORREO_TRABAJADOR_INTERVALO_MS',
    ),
    maxPorCiclo: leerEntero(
      env.CORREO_TRABAJADOR_MAX_POR_CICLO,
      10,
      1,
      100,
      'CORREO_TRABAJADOR_MAX_POR_CICLO',
    ),
  };
}

function leerEntero(
  valor: string | undefined,
  predeterminado: number,
  minimo: number,
  maximo: number,
  nombre: string,
): number {
  if (valor === undefined) {
    return predeterminado;
  }

  // Rechaza espacios, saltos de línea, decimales y notación exponencial.
  if (
    valor.length === 0 ||
    /[^0-9]/.test(valor)
  ) {
    throw new Error(`${nombre} debe ser un entero válido.`);
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero < minimo ||
    numero > maximo
  ) {
    throw new Error(
      `${nombre} debe estar entre ${minimo} y ${maximo}.`,
    );
  }

  return numero;
}