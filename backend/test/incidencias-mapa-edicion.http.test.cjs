require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { UnauthorizedException } = require('@nestjs/common');

const {
  IncidenciasMapaEdicionController,
} = require('../dist/modules/incidencias/incidencias-mapa-edicion.controller');
const {
  IncidenciasMapaEdicionService,
} = require('../dist/modules/incidencias/incidencias-mapa-edicion.service');
const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');
const {
  ProyectoAccesoRepository,
} = require('../dist/common/repositories/proyecto-acceso.repository');
const {
  ActividadesRepository,
} = require('../dist/modules/actividades/actividades.repository');
const {
  DatabaseService,
} = require('../dist/database/database.service');
const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');
const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const INCIDENCIA = '30000000-0000-4000-8000-000000000001';
const EDITOR = '10000000-0000-4000-8000-000000000001';
const CREADOR = '10000000-0000-4000-8000-000000000002';

const DATOS = {
  titulo: 'Fisura revisada',
  descripcion: 'Reparación verificada.',
  prioridad: 'BAJA',
  estado: 'SOLUCIONADA',
};

async function conAplicacion(ejecutar, opciones = {}) {
  const client = {};
  const eventos = [];

  const modulo = await Test.createTestingModule({
    controllers: [IncidenciasMapaEdicionController],
    providers: [
      IncidenciasMapaEdicionService,
      {
        provide: DatabaseService,
        useValue: {
          async withTransaction(operacion) {
            eventos.push('iniciar');
            const resultado = await operacion(client);
            eventos.push('confirmar');
            return resultado;
          },
        },
      },
      {
        provide: ProyectoAccesoRepository,
        useValue: {
          async bloquearDisponible(conexion, proyecto, usuario) {
            assert.strictEqual(conexion, client);
            assert.equal(proyecto, PROYECTO);
            assert.equal(usuario, EDITOR);
            eventos.push('autorizar');
            return !opciones.sinAcceso;
          },
        },
      },
      {
        provide: IncidenciasRepository,
        useValue: {
          async actualizarDatosEnMapa(
            conexion, proyecto, incidencia, datos,
          ) {
            assert.strictEqual(conexion, client);
            assert.equal(proyecto, PROYECTO);
            assert.equal(incidencia, INCIDENCIA);
            assert.deepEqual(datos, DATOS);
            eventos.push('actualizar');

            if (opciones.ausente) return null;

            return {
              id_incidencia: INCIDENCIA,
              id_proyecto: PROYECTO,
              id_creador: CREADOR,
              ...datos,
              id_plano: null,
              numero_pagina: null,
              coordenada_x: null,
              coordenada_y: null,
              latitud: '4.711',
              longitud: '-74.0721',
              fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
            };
          },
        },
      },
      {
        provide: ActividadesRepository,
        useValue: {
          async crear(conexion, datos) {
            assert.strictEqual(conexion, client);
            assert.deepEqual(datos, {
              idProyecto: PROYECTO,
              idActor: EDITOR,
              tipoAccion: 'INCIDENCIA_DATOS_GUARDADOS',
              mensaje: `Datos de la incidencia ${INCIDENCIA} guardados.`,
            });
            eventos.push('actividad');

            if (opciones.fallaActividad) {
              throw new Error('Fallo interno simulado');
            }
          },
        },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (opciones.sinSesion) {
          throw new UnauthorizedException();
        }

        contexto.switchToHttp().getRequest().usuario = {
          id_usuario: EDITOR,
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

    async function enviar(datos = DATOS, idIncidencia = INCIDENCIA) {
      const respuesta = await fetch(
        `http://127.0.0.1:${port}/api/proyectos/${PROYECTO}/incidencias/mapa/${idIncidencia}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );

      return {
        status: respuesta.status,
        cache: respuesta.headers.get('cache-control'),
        cuerpo: await respuesta.json(),
      };
    }

    await ejecutar({ enviar, eventos });
  } finally {
    await app.close();
  }
}

test('PATCH mapa: edita con otro usuario y conserva creador y ubicación', async () => {
  await conAplicacion(async ({ enviar, eventos }) => {
    const respuesta = await enviar();

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cache, 'no-store');
    assert.deepEqual(respuesta.cuerpo, {
      id_incidencia: INCIDENCIA,
      id_proyecto: PROYECTO,
      id_creador: CREADOR,
      ...DATOS,
      id_plano: null,
      numero_pagina: null,
      coordenada_x: null,
      coordenada_y: null,
      latitud: 4.711,
      longitud: -74.0721,
      fecha_creacion: '2026-09-22T12:00:00.000Z',
    });

    assert.deepEqual(eventos, [
      'iniciar', 'autorizar', 'actualizar', 'actividad', 'confirmar',
    ]);
  });
});

for (const [nombre, datos, id] of [
  ['identificador inválido', DATOS, 'incorrecto'],
  ['autoría enviada', { ...DATOS, id_creador: EDITOR }],
  ['ubicación enviada', { ...DATOS, latitud: 0 }],
  ['estado inválido', { ...DATOS, estado: 'CERRADA' }],
]) {
  test(`PATCH mapa: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, eventos }) => {
      assert.equal((await enviar(datos, id)).status, 400);
      assert.deepEqual(eventos, []);
    });
  });
}

test('PATCH mapa: exige sesión', async () => {
  await conAplicacion(async ({ enviar, eventos }) => {
    assert.equal((await enviar()).status, 401);
    assert.deepEqual(eventos, []);
  }, { sinSesion: true });
});

test('PATCH mapa: rechaza el proyecto sin escribir', async () => {
  await conAplicacion(async ({ enviar, eventos }) => {
    const respuesta = await enviar();

    assert.equal(respuesta.status, 404);
    assert.equal(respuesta.cuerpo.message, 'El proyecto no está disponible.');
    assert.deepEqual(eventos, ['iniciar', 'autorizar']);
  }, { sinAcceso: true });
});

test('PATCH mapa: no registra actividad si la incidencia no está disponible', async () => {
  await conAplicacion(async ({ enviar, eventos }) => {
    const respuesta = await enviar();

    assert.equal(respuesta.status, 404);
    assert.equal(respuesta.cuerpo.message, 'La incidencia no está disponible.');
    assert.deepEqual(eventos, ['iniciar', 'autorizar', 'actualizar']);
  }, { ausente: true });
});

test('PATCH mapa: no confirma si falla la actividad', async () => {
  await conAplicacion(async ({ enviar, eventos }) => {
    assert.equal((await enviar()).status, 500);
    assert.deepEqual(eventos, [
      'iniciar', 'autorizar', 'actualizar', 'actividad',
    ]);
  }, { fallaActividad: true });
});