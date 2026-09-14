require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { Test } = require('@nestjs/testing');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasDescargaController,
} = require('../dist/modules/fotografias/fotografias-descarga.controller');

const {
  FotografiasDescargaService,
} = require('../dist/modules/fotografias/fotografias-descarga.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const NOMBRE = '30000000-0000-4000-8000-000000000003.webp';

const http = require('node:http');

/**
 * Ejecuta peticiones HTTP reales contra un controlador aislado.
 *
 * Sustituimos autenticación y servicio para comprobar exclusivamente
 * la transferencia y el manejo HTTP de sus resultados.
 */
async function conAplicacion(abrirOptimizada, ejecutar) {
  const modulo = await Test.createTestingModule({
    controllers: [FotografiasDescargaController],
    providers: [
      {
        provide: FotografiasDescargaService,
        useValue: { abrirOptimizada },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        contexto.switchToHttp().getRequest().usuario = {
          id_usuario: ID_USUARIO,
        };

        return true;
      },
    })
    .compile();

  const app = modulo.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');

  try {
    await app.listen(0, '127.0.0.1');

    const direccion = app.getHttpServer().address();
    const base =
      `http://127.0.0.1:${direccion.port}` +
      '/api/proyectos';

    await ejecutar({
      url: `${base}/${ID_PROYECTO}/fotografias/archivos/${NOMBRE}`,
      base,
    });
  } finally {
    await app.close();
  }
}

test(
  'GET fotografía: transmite los bytes, utiliza la sesión y cierra el flujo',
  async () => {
    /*
     * El controlador transmite bytes sin interpretar la imagen.
     * La validación WebP corresponde al procesamiento de subida.
     */
    const contenido = Buffer.from([0, 10, 127, 128, 255]);
    const flujo = Readable.from([contenido]);
    const llamadas = [];

    // Esperamos el cierre explícitamente, sin pausas temporizadas.
    const cierre = new Promise((resolve) => {
      flujo.once('close', resolve);
    });

    try {
      await conAplicacion(
        async (...argumentos) => {
          llamadas.push(argumentos);
          return flujo;
        },
        async ({ url }) => {
          const respuesta = await fetch(url);
          const recibido = Buffer.from(await respuesta.arrayBuffer());

          assert.equal(respuesta.status, 200);
          assert.deepEqual(recibido, contenido);

          assert.equal(
            respuesta.headers.get('content-type'),
            'image/webp',
          );
          assert.equal(
            respuesta.headers.get('content-disposition'),
            'inline',
          );
          assert.equal(
            respuesta.headers.get('cache-control'),
            'no-store',
          );
          assert.equal(
            respuesta.headers.get('x-content-type-options'),
            'nosniff',
          );

          assert.deepEqual(llamadas, [
            [ID_PROYECTO, ID_USUARIO, NOMBRE],
          ]);

          await cierre;
          assert.equal(flujo.destroyed, true);
        },
      );
    } finally {
      flujo.destroy();
    }
  },
);

test(
  'GET fotografía: devuelve HTTP 404 cuando el servicio rechaza el acceso',
  async () => {
    await conAplicacion(
      async () => {
        throw new NotFoundException(
          'La fotografía no está disponible.',
        );
      },
      async ({ url }) => {
        const respuesta = await fetch(url);
        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 404);
        assert.equal(
          cuerpo.message,
          'La fotografía no está disponible.',
        );

        // El error debe conservar su representación JSON.
        assert.match(
          respuesta.headers.get('content-type'),
          /^application\/json\b/,
        );
      },
    );
  },
);

test(
  'GET fotografía: rechaza un proyecto inválido antes de invocar el servicio',
  async () => {
    let llamadas = 0;

    await conAplicacion(
      async () => {
        llamadas += 1;
        throw new Error('El servicio no debería ejecutarse.');
      },
      async ({ base }) => {
        const respuesta = await fetch(
          `${base}/no-es-uuid/fotografias/archivos/${NOMBRE}`,
        );

        await respuesta.json();

        assert.equal(respuesta.status, 400);
        assert.equal(llamadas, 0);
      },
    );
  },
);

test(
  'GET fotografía: oculta los detalles de un fallo anterior a la transferencia',
  async () => {
    const detallePrivado = 'Detalle interno del almacenamiento de prueba';

    await conAplicacion(
      async () => {
        throw new Error(detallePrivado);
      },
      async ({ url }) => {
        const respuesta = await fetch(url);
        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 500);
        assert.equal(
          JSON.stringify(cuerpo).includes(detallePrivado),
          false,
        );
        assert.match(
          respuesta.headers.get('content-type'),
          /^application\/json\b/,
        );
      },
    );
  },
);

test(
  'GET fotografía: cierra el flujo cuando el cliente interrumpe la descarga',
  { timeout: 10_000 },
  async () => {
    let primerFragmentoEnviado = false;

    /*
     * Emitimos un fragmento y mantenemos la descarga abierta.
     * No enviamos null: el flujo solo terminará cuando se destruya.
     *
     * Esto permite comprobar una cancelación durante la transferencia,
     * sin depender de archivos grandes ni de pausas artificiales.
     */
    const flujo = new Readable({
      read() {
        if (!primerFragmentoEnviado) {
          primerFragmentoEnviado = true;
          this.push(Buffer.alloc(1024, 7));
        }
      },
    });

    let cerrarConfirmado;
    const cierre = new Promise((resolve) => {
      cerrarConfirmado = resolve;
    });

    flujo.once('close', cerrarConfirmado);

    let peticion;
    let respuestaCliente;

    try {
      await conAplicacion(
        async () => flujo,
        async ({ url }) => {
          await new Promise((resolve, reject) => {
            peticion = http.get(url, (respuesta) => {
              respuestaCliente = respuesta;

              if (respuesta.statusCode !== 200) {
                respuesta.resume();
                reject(
                  new Error(
                    `Se esperaba HTTP 200 y se recibió ${respuesta.statusCode}.`,
                  ),
                );
                return;
              }

              respuesta.once('error', reject);

              respuesta.once('data', () => {
                /*
                 * Cancelamos después de recibir datos.
                 * Así sabemos que pipeline ya inició la transferencia.
                 */
                respuesta.destroy();
                peticion.destroy();
                resolve();
              });
            });

            peticion.once('error', reject);
          });

          /*
           * Esperamos un evento real de cierre del lado del servidor.
           * El timeout es únicamente un límite para detectar bloqueos.
           */
          await cierre;

          assert.equal(primerFragmentoEnviado, true);
          assert.equal(flujo.destroyed, true);
          assert.equal(flujo.readableEnded, false);
        },
      );
    } finally {
      respuestaCliente?.destroy();
      peticion?.destroy();
      flujo.destroy();
    }
  },
);