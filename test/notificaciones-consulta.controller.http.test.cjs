require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { UnauthorizedException } = require('@nestjs/common');

const {
  NotificacionesConsultaController,
} = require('../dist/modules/notificaciones/notificaciones-consulta.controller');

const {
  NotificacionesConsultaService,
} = require('../dist/modules/notificaciones/notificaciones-consulta.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Comprueba la ruta y la validación reales.
 * Sustituye guard y servicio para aislar el transporte HTTP.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [NotificacionesConsultaController],
    providers: [{
      provide: NotificacionesConsultaService,
      useValue: {
        async listar(usuario, parametros) {
          llamadas.push([usuario, { ...parametros }]);

          return {
            notificaciones: [],
            pagina: parametros.pagina,
            limite: parametros.limite,
            total: 0,
            total_paginas: 0,
          };
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

        if (!opciones.sinIdentidad) {
          contexto.switchToHttp().getRequest().usuario = {
            id_usuario: USUARIO,
          };
        }

        return true;
      },
    })
    .compile();

  const app = modulo.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());

  try {
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address();

    const consultar = (parametros = '') =>
      fetch(
        `http://127.0.0.1:${port}/api/notificaciones${parametros}`,
      );

    await ejecutar({ consultar, llamadas });
  } finally {
    await app.close();
  }
}

test('GET notificaciones: utiliza la sesión y la paginación predeterminada', async () => {
  await conAplicacion(async ({ consultar, llamadas }) => {
    const respuesta = await consultar();

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');

    assert.deepEqual(await respuesta.json(), {
      notificaciones: [],
      pagina: 1,
      limite: 20,
      total: 0,
      total_paginas: 0,
    });

    assert.deepEqual(llamadas, [[USUARIO, {
      pagina: 1,
      limite: 20,
    }]]);
  });
});

test('GET notificaciones: convierte los parámetros de paginación', async () => {
  await conAplicacion(async ({ consultar, llamadas }) => {
    const respuesta = await consultar('?pagina=2&limite=10');
    await respuesta.json();

    assert.equal(respuesta.status, 200);
    assert.deepEqual(llamadas, [[USUARIO, {
      pagina: 2,
      limite: 10,
    }]]);
  });
});

for (const [nombre, parametros] of [
  ['página inválida', '?pagina=0'],
  ['límite excesivo', '?limite=101'],
  ['receptor proporcionado por el cliente', '?id_receptor=otro'],
]) {
  test(`GET notificaciones: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ consultar, llamadas }) => {
      const respuesta = await consultar(parametros);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('GET notificaciones: rechaza solicitudes sin sesión', async () => {
  await conAplicacion(async ({ consultar, llamadas }) => {
    const respuesta = await consultar();
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinSesion: true });
});

test('GET notificaciones: rechaza defensivamente una identidad ausente', async () => {
  await conAplicacion(async ({ consultar, llamadas }) => {
    const respuesta = await consultar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(
      cuerpo.message,
      'La sesión no es válida o ha expirado.',
    );
    assert.equal(llamadas.length, 0);
  }, { sinIdentidad: true });
});