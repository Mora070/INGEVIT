require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const {
  BadRequestException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  IncidenciasCreacionController,
} = require('../dist/modules/incidencias/incidencias-creacion.controller');

const {
  IncidenciasCreacionService,
} = require('../dist/modules/incidencias/incidencias-creacion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

const DATOS = {
  titulo: 'Fisura',
  descripcion: 'Revisar el punto señalado.',
  prioridad: 'MEDIA',
  numero_pagina: 1,
  coordenada_x: 120.5,
  coordenada_y: 80.25,
};

/**
 * Comprueba el transporte y la validación reales.
 * Sustituye la autenticación y el servicio para aislar el controlador.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [IncidenciasCreacionController],
    providers: [{
      provide: IncidenciasCreacionService,
      useValue: {
        async crear(...argumentos) {
          llamadas.push(argumentos);

          if (opciones.errorServicio) {
            throw opciones.errorServicio;
          }

          return {
            id_incidencia: '40000000-0000-4000-8000-000000000001',
            ...DATOS,
            estado: 'PENDIENTE',
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
  app.useGlobalPipes(createValidationPipe());

  try {
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address();

    const enviar = (
      datos = DATOS,
      proyecto = PROYECTO,
      plano = PLANO,
    ) =>
      fetch(
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/planos/${plano}/incidencias`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );

    await ejecutar({ enviar, llamadas });
  } finally {
    await app.close();
  }
}

test('POST incidencias: devuelve 201 y utiliza la identidad autenticada', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.equal(cuerpo.estado, 'PENDIENTE');
    assert.equal(llamadas.length, 1);

    const [proyecto, plano, usuario, datos] = llamadas[0];

    assert.equal(proyecto, PROYECTO);
    assert.equal(plano, PLANO);
    assert.equal(usuario, USUARIO);
    assert.deepEqual({ ...datos }, DATOS);
  });
});

const invalidos = [
  ['proyecto inválido', DATOS, 'incorrecto', PLANO],
  ['plano inválido', DATOS, PROYECTO, 'incorrecto'],
  ['página como texto', { ...DATOS, numero_pagina: '1' }],
  ['creador adicional', { ...DATOS, id_creador: USUARIO }],
  ['estado adicional', { ...DATOS, estado: 'SOLUCIONADA' }],
];

for (const [nombre, datos, proyecto, plano] of invalidos) {
  test(`POST incidencias: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(datos, proyecto, plano);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('POST incidencias: rechaza solicitudes sin sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinSesion: true });
});

test('POST incidencias: conserva el rechazo de una página inexistente', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 400);
    assert.equal(
      cuerpo.message,
      'La página indicada no existe en el plano.',
    );
    assert.equal(llamadas.length, 1);
  }, {
    errorServicio: new BadRequestException(
      'La página indicada no existe en el plano.',
    ),
  });
});