export interface CapasTrabajadorConfig {
  habilitado: boolean;
  intervaloMs: number;
}

/** El procesamiento automático requiere activación explícita. */
export function getCapasTrabajadorConfig(
  env: NodeJS.ProcessEnv = process.env,
): CapasTrabajadorConfig {
  const habilitado = env.CAPAS_TRABAJADOR_HABILITADO ?? 'false';
  const intervalo = env.CAPAS_TRABAJADOR_INTERVALO_MS ?? '5000';

  if (habilitado !== 'true' && habilitado !== 'false') {
    throw new Error(
      'CAPAS_TRABAJADOR_HABILITADO debe ser true o false.',
    );
  }

  if (!/^[1-9][0-9]*$/.test(intervalo)) {
    throw new Error(
      'CAPAS_TRABAJADOR_INTERVALO_MS debe ser un entero positivo.',
    );
  }

  const intervaloMs = Number(intervalo);

  if (
    !Number.isSafeInteger(intervaloMs)
    || intervaloMs < 1000
    || intervaloMs > 2147483647
  ) {
    throw new Error(
      'CAPAS_TRABAJADOR_INTERVALO_MS debe estar entre 1000 y 2147483647.',
    );
  }

  return {
    habilitado: habilitado === 'true',
    intervaloMs,
  };
}