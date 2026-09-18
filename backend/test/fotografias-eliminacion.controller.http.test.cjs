require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasEliminacionController,
} = require('../dist/modules/fotografias/fotografias-eliminacion.controller');

const {
  FotografiasEliminacionService,
} = require('../dist/modules/fotografias/fotografias-eliminacion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Comprueba el controlador mediante peticiones HTTP.
 *
 * Sustituye el guard y el servicio para aislar el transporte.
 * No elimina registros ni archivos.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [FotografiasEliminacionController],
    providers: [
      {
        provide: FotografiasEliminacionService,
        useValue: {
          async eliminar(...argumentos) {
            llamadas.push(argumentos);

            if (opciones.errorServicio) {
              throw opciones.errorServicio;
            }
          },
        },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (!opciones.sinIdentidad) {
          contexto.switchToHttp().getRequest().usuario = {
            id_usuario: ID_USUARIO,
          };
        }

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
    const base = `http://127.0.0.1:${direccion.port}/api/proyectos`;

    const enviar = (
      idProyecto = ID_PROYECTO,
      idFotografia = ID_FOTOGRAFIA,
    ) =>
      fetch(`${base}/${idProyecto}/fotografias/${idFotografia}`, {
        method: 'DELETE',
      });

    await ejecutar({ enviar, llamadas });
  } finally {
    await app.close();
  }
}

test(
  'DELETE fotografía: utiliza la sesión y devuelve 204 sin cuerpo',
  async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar();

      assert.equal(respuesta.status, 204);
      assert.equal(await respuesta.text(), '');
      assert.equal(
        respuesta.headers.get('cache-control'),
        'no-store',
      );

      assert.deepEqual(llamadas, [
        [ID_PROYECTO, ID_FOTOGRAFIA, ID_USUARIO],
      ]);
    });
  },
);

for (const [descripcion, proyecto, fotografia] of [
  ['proyecto inválido', 'no-es-uuid', ID_FOTOGRAFIA],
  ['fotografía inválida', ID_PROYECTO, 'no-es-uuid'],
]) {
  test(
    `DELETE fotografía: rechaza ${descripcion} antes de invocar el servicio`,
    async () => {
      await conAplicacion(async ({ enviar, llamadas }) => {
        const respuesta = await enviar(proyecto, fotografia);
        await respuesta.json();

        assert.equal(respuesta.status, 400);
        assert.equal(llamadas.length, 0);
      });
    },
  );
}

test(
  'DELETE fotografía: la comprobación defensiva rechaza una identidad ausente',
  async () => {
    await conAplicacion(
      async ({ enviar, llamadas }) => {
        const respuesta = await enviar();
        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 401);
        assert.equal(
          cuerpo.message,
          'La sesión no es válida o ha expirado.',
        );
        assert.equal(llamadas.length, 0);
      },
      { sinIdentidad: true },
    );
  },
);

test(
  'DELETE fotografía: conserva el rechazo del servicio',
  async () => {
    await conAplicacion(
      async ({ enviar, llamadas }) => {
        const respuesta = await enviar();
        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 404);
        assert.equal(
          cuerpo.message,
          'La fotografía no está disponible.',
        );
        assert.equal(llamadas.length, 1);
      },
      {
        errorServicio: new NotFoundException(
          'La fotografía no está disponible.',
        ),
      },
    );
  },
);

test(
  'DELETE fotografía: devuelve 500 sin exponer detalles internos del fallo',
  async () => {
    const detallePrivado = 'Detalle interno de PostgreSQL de prueba';

    await conAplicacion(
      async ({ enviar }) => {
        const respuesta = await enviar();
        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 500);
        assert.equal(
          JSON.stringify(cuerpo).includes(detallePrivado),
          false,
        );
      },
      { errorServicio: new Error(detallePrivado) },
    );
  },
);