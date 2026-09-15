require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  PlanosEliminacionController,
} = require('../dist/modules/planos/planos-eliminacion.controller');

const {
  PlanosEliminacionService,
} = require('../dist/modules/planos/planos-eliminacion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Aísla el transporte HTTP.
 * Los permisos reales y la transacción se comprueban en integración.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [PlanosEliminacionController],
    providers: [{
      provide: PlanosEliminacionService,
      useValue: {
        async eliminar(...argumentos) {
          llamadas.push(argumentos);

          if (opciones.errorServicio) {
            throw opciones.errorServicio;
          }
        },
      },
    }],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (opciones.sinSesion) {
          throw new UnauthorizedException();
        }

        contexto.switchToHttp().getRequest().usuario = {
          id_usuario: USUARIO,
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
    const { port } = app.getHttpServer().address();

    const enviar = (
      proyecto = PROYECTO,
      plano = PLANO,
    ) =>
      fetch(
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/planos/${plano}`,
        { method: 'DELETE' },
      );

    await ejecutar({ enviar, llamadas });
  } finally {
    await app.close();
  }
}

test('DELETE planos: utiliza la sesión y devuelve 204 sin cuerpo', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();

    assert.equal(respuesta.status, 204);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.equal(await respuesta.text(), '');

    assert.deepEqual(llamadas, [[PROYECTO, PLANO, USUARIO]]);
  });
});

for (const [nombre, proyecto, plano] of [
  ['proyecto inválido', 'incorrecto', PLANO],
  ['plano inválido', PROYECTO, 'incorrecto'],
]) {
  test(`DELETE planos: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(proyecto, plano);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('DELETE planos: rechaza solicitudes sin sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinSesion: true });
});

test('DELETE planos: conserva el rechazo del servicio', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 404);
    assert.equal(cuerpo.message, 'El plano no está disponible.');
    assert.equal(llamadas.length, 1);
  }, {
    errorServicio: new NotFoundException(
      'El plano no está disponible.',
    ),
  });
});