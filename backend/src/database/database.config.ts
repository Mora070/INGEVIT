import type { PoolConfig } from 'pg';

/**
 * Obtiene una variable obligatoria del entorno.
 *
 * No incluye su contenido en los errores para evitar exponer
 * contraseñas u otros datos de conexión en los registros.
 */
function getRequiredVariable(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Configuración de PostgreSQL incompleta: falta la variable ${name}.`,
    );
  }

  // Conservamos el valor original, especialmente en las contraseñas.
  return value;
}

/**
 * Construye la configuración de conexión a PostgreSQL.
 *
 * Las variables deben haber sido cargadas al iniciar Node.js
 * mediante --env-file=.env.
 *
 * Esta función no abre conexiones. El servicio de base de datos
 * será responsable de crear y cerrar el pool.
 *
 * Recibir el entorno como argumento permite probar esta función
 * sin modificar las variables reales del proceso.
 */
export function getDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  const host = getRequiredVariable(environment, 'DB_HOST');
  const portText = getRequiredVariable(environment, 'DB_PORT');
  const database = getRequiredVariable(environment, 'DB_NAME');
  const user = getRequiredVariable(environment, 'DB_USER');
  const password = getRequiredVariable(environment, 'DB_PASSWORD');

  const port = Number(portText);

  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'Configuración de PostgreSQL inválida: DB_PORT debe ser un entero entre 1 y 65535.',
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,

    // Identifica las conexiones del backend dentro de PostgreSQL.
    application_name: 'ingevit-backend',

    // Límite por proceso del backend, no por usuario de la aplicación.
    max: 10,

    // Cierra conexiones ociosas después de 30 segundos.
    idleTimeoutMillis: 30_000,

    // Limita a 5 segundos la espera para obtener una conexión.
    connectionTimeoutMillis: 5_000,
  };
}