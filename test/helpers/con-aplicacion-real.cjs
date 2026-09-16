require('reflect-metadata');

const { randomBytes } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const { NestFactory } = require('@nestjs/core');
const cookieParser = require('cookie-parser');

const {
  createValidationPipe,
} = require('../../dist/common/pipes/create-validation-pipe');

/**
 * Ejecuta una operación contra el backend real por HTTP.
 *
 * - Utiliza PostgreSQL configurado mediante DB_*.
 * - Conserva los guards y servicios reales.
 * - Almacena archivos en una carpeta temporal exclusiva.
 * - Firma las sesiones con una clave temporal.
 * - Escucha en un puerto libre asignado por el sistema.
 *
 * La operación recibida debe limpiar sus datos de PostgreSQL
 * antes de terminar. Este ayudante limpia la aplicación y los archivos.
 *
 * No ejecutar llamadas concurrentes a este ayudante en un mismo
 * proceso: modifica temporalmente variables de entorno.
 */
async function conAplicacionReal(
  ejecutar,
  { habilitarTrabajador = false } = {},
) {
  const raizTemporal = await mkdtemp(
    path.join(tmpdir(), 'ingevit-http-real-'),
  );

  const nombresVariables = [
    'STORAGE_LOCAL_ROOT',
    'AUTH_JWT_SECRET',
    'AUTH_ALLOWED_ORIGINS',
    'NODE_ENV',
    'ARCHIVOS_PENDIENTES_HABILITADO',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    'CORREO_PROVEEDOR',
    'CORREO_SMTP_HOST',
    'CORREO_SMTP_PORT',
    'CORREO_REMITENTE_NOMBRE',
    'CORREO_REMITENTE_DIRECCION',
    'CORREO_TRABAJADOR_HABILITADO',
    'CORREO_TRABAJADOR_INTERVALO_MS',
    'CORREO_TRABAJADOR_MAX_POR_CICLO',
  ];

  const valoresAnteriores = new Map(
    nombresVariables.map((nombre) => [
      nombre,
      process.env[nombre],
    ]),
  );

  /*
   * Simula un origen de frontend permitido.
   * No se abre ninguna conexión hacia este origen.
   */
  const origen = 'http://127.0.0.1:4300';

  let app;

  try {
    process.env.STORAGE_LOCAL_ROOT = raizTemporal;
    process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex');
    process.env.AUTH_ALLOWED_ORIGINS = origen;
    process.env.NODE_ENV = 'development';
    /*
 * Configuración determinista para construir el módulo de correo.
 * Las pruebas HTTP habituales no activan el trabajador ni necesitan
 * que Mailpit esté encendido.
 */
    process.env.CORREO_PROVEEDOR = 'mailpit';
    process.env.CORREO_SMTP_HOST = '127.0.0.1';
    process.env.CORREO_SMTP_PORT = '1025';
    process.env.CORREO_REMITENTE_NOMBRE = 'INGEVIT Pruebas';
    process.env.CORREO_REMITENTE_DIRECCION =
      'notificaciones@ingevit.test';

    process.env.CORREO_TRABAJADOR_HABILITADO = 'false';
    process.env.CORREO_TRABAJADOR_INTERVALO_MS = '5000';
    process.env.CORREO_TRABAJADOR_MAX_POR_CICLO = '10';
    /*
     * El procesamiento automático solo se activa cuando una prueba
     * lo solicita expresamente.
     */
    process.env.ARCHIVOS_PENDIENTES_HABILITADO =
      habilitarTrabajador ? 'true' : 'false';

    if (habilitarTrabajador) {
      // Intervalo mínimo admitido para comprobar el temporizador real.
      process.env.ARCHIVOS_PENDIENTES_INTERVALO_MS = '1000';
    }

    // Cargamos el módulo después de establecer el entorno temporal.
    const { AppModule } = require('../../dist/app.module');

    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });

    /*
     * Reproducimos la configuración HTTP de main.ts.
     * No importamos main.ts porque inicia el servidor automáticamente.
     */
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());
    app.setGlobalPrefix('api');

    // El puerto cero solicita un puerto libre al sistema operativo.
    await app.listen(0, '127.0.0.1');

    const direccion = app.getHttpServer().address();
    const baseUrl = `http://127.0.0.1:${direccion.port}`;

    return await ejecutar({
      app,
      baseUrl,
      origen,
      raizTemporal,
    });
  } finally {
    try {
      if (app) {
        // Ejecuta también los hooks que cierran el pool de PostgreSQL.
        await app.close();
      }
    } finally {
      for (const [nombre, valorAnterior] of valoresAnteriores) {
        if (valorAnterior === undefined) {
          delete process.env[nombre];
        } else {
          process.env[nombre] = valorAnterior;
        }
      }

      // Solo elimina la carpeta exclusiva creada por este ayudante.
      await rm(raizTemporal, {
        recursive: true,
        force: true,
      });
    }
  }
}

module.exports = {
  conAplicacionReal,
};