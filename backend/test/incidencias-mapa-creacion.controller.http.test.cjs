require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  IncidenciasMapaCreacionController,
} = require('../dist/modules/incidencias/incidencias-mapa-creacion.controller');

const {
  IncidenciasMapaCreacionService,
} = require('../dist/modules/incidencias/incidencias-mapa-creacion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

const DATOS = {
  titulo: 'Fisura en el acceso',
  descripcion: 'Revisar el punto señalado.',
  prioridad: 'ALTA',
  latitud: 4.711,
  longitud: -74.0721,
};

/**
 * Prueba el transporte HTTP y la validación reales.
 * Sustituye el guard y el servicio: no consulta PostgreSQL.
 * La autenticación real se comprobará en integración.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [IncidenciasMapaCreacionController],
    providers: [{
      provide: IncidenciasMapaCreacionService,
      useValue: {
        async crear(proyecto, usuario, datos) {
          llamadas.push([proyecto, usuario, datos]);

          if (opciones.errorServicio) {
            throw opciones.errorServicio;
          }

          return {
            id_incidencia: '30000000-0000-4000-8000-000000000001',
            id_proyecto: proyecto,
            id_creador: usuario,
            ...datos,
            estado: 'PENDIENTE',
            id_plano: null,
            numero_pagina: null,
            coordenada_x: null,
            coordenada_y: null,
            fecha_creacion: '2026-09-22T12:00:00.000Z',
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

    const enviar = (datos = DATOS, proyecto = PROYECTO) =>
      fetch(
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/incidencias/mapa`,
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

test('POST incidencias de mapa: devuelve 201 y utiliza la sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.equal(llamadas.length, 1);

    const [proyecto, usuario, datos] = llamadas[0];

    assert.equal(proyecto, PROYECTO);
    assert.equal(usuario, USUARIO);
    assert.deepEqual({ ...datos }, DATOS);

    assert.equal(cuerpo.id_creador, USUARIO);
    assert.equal(cuerpo.estado, 'PENDIENTE');
    assert.equal(cuerpo.id_plano, null);
    assert.equal(cuerpo.numero_pagina, null);
    assert.equal(cuerpo.coordenada_x, null);
    assert.equal(cuerpo.coordenada_y, null);
    assert.equal(cuerpo.latitud, DATOS.latitud);
    assert.equal(cuerpo.longitud, DATOS.longitud);
  });
});

for (const [nombre, datos, proyecto] of [
  ['proyecto inválido', DATOS, 'incorrecto'],
  ['latitud ausente', { ...DATOS, latitud: undefined }],
  ['longitud ausente', { ...DATOS, longitud: undefined }],
  ['coordenada como texto', { ...DATOS, latitud: '4.711' }],
  ['coordenada fuera de rango', { ...DATOS, longitud: 181 }],
  ['creador enviado por el cliente', { ...DATOS, id_creador: USUARIO }],
  ['estado enviado por el cliente', { ...DATOS, estado: 'SOLUCIONADA' }],
  ['contexto de plano', { ...DATOS, id_plano: null }],
]) {
  test(`POST incidencias de mapa: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(datos, proyecto);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('POST incidencias de mapa: exige sesión antes de validar el cuerpo', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar({});
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinSesion: true });
});

test('POST incidencias de mapa: rechaza una petición sin identidad autenticada', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinIdentidad: true });
});

test('POST incidencias de mapa: conserva el rechazo de acceso del servicio', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar();
    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 404);
    assert.equal(cuerpo.message, 'El proyecto no está disponible.');
    assert.equal(llamadas.length, 1);
  }, {
    errorServicio: new NotFoundException(
      'El proyecto no está disponible.',
    ),
  });
});