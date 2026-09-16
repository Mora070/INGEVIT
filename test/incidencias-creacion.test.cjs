require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasCreacionService,
} = require('../dist/modules/incidencias/incidencias-creacion.service');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const INCIDENCIA = '40000000-0000-4000-8000-000000000001';

const DATOS = {
  titulo: "Fisura'); SELECT 1; --",
  descripcion: 'Revisar el muro.',
  prioridad: 'MEDIA',
  numero_pagina: 3,
  coordenada_x: 120.5,
  coordenada_y: 80.25,
};

function preparar({
  acceso = true,
  paginas = 3,
  errorActividad,
} = {}) {
  const eventos = [];

  const client = {
    async query(sql, valores) {
      eventos.push('insertar');

      assert.equal(sql.includes(DATOS.titulo), false);
      assert.match(sql, /'PENDIENTE'/);
      assert.deepEqual(valores, [
        PROYECTO,
        PLANO,
        USUARIO,
        DATOS.titulo,
        DATOS.descripcion,
        DATOS.prioridad,
        DATOS.numero_pagina,
        DATOS.coordenada_x,
        DATOS.coordenada_y,
      ]);

      return {
        rowCount: 1,
        rows: [{
          id_incidencia: INCIDENCIA,
          id_proyecto: PROYECTO,
          id_plano: PLANO,
          id_creador: USUARIO,
          ...DATOS,
          estado: 'PENDIENTE',
          coordenada_x: '120.5',
          coordenada_y: '80.25',
          fecha_creacion: new Date('2026-09-15T12:00:00.000Z'),
          campo_interno: 'no publicar',
        }],
      };
    },
  };

  const service = new IncidenciasCreacionService(
    {
      async withTransaction(operacion) {
        const resultado = await operacion(client);
        eventos.push('confirmar');
        return resultado;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(usuario, USUARIO);
        eventos.push('acceso');
        return acceso;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, plano) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(plano, PLANO);
        eventos.push('plano');
        return paginas;
      },
    },
    new IncidenciasRepository(),
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: PROYECTO,
          idActor: USUARIO,
          tipoAccion: 'INCIDENCIA_CREADA',
          mensaje:
            `Incidencia ${INCIDENCIA} creada en el plano ${PLANO}.`,
        });

        eventos.push('actividad');

        if (errorActividad) {
          throw errorActividad;
        }
      },
    },
  );

  return {
    eventos,
    ejecutar: (datos = DATOS) =>
      service.crear(PROYECTO, PLANO, USUARIO, datos),
  };
}

test('IncidenciasCreacion: admite la última página, parametriza y devuelve datos públicos', async () => {
  const { ejecutar, eventos } = preparar();
  const resultado = await ejecutar();

  assert.deepEqual(resultado, {
    id_incidencia: INCIDENCIA,
    id_proyecto: PROYECTO,
    id_plano: PLANO,
    id_creador: USUARIO,
    ...DATOS,
    estado: 'PENDIENTE',
    fecha_creacion: '2026-09-15T12:00:00.000Z',
  });

  assert.deepEqual(eventos, [
    'acceso', 'plano', 'insertar', 'actividad', 'confirmar',
  ]);
});

test('IncidenciasCreacion: rechaza el proyecto sin consultar el plano', async () => {
  const { ejecutar, eventos } = preparar({ acceso: false });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('IncidenciasCreacion: rechaza un plano no disponible', async () => {
  const { ejecutar, eventos } = preparar({ paginas: null });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El plano no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['acceso', 'plano']);
});

test('IncidenciasCreacion: rechaza páginas inexistentes antes de insertar', async () => {
  for (const numero_pagina of [0, -1, 1.5, 4]) {
    const { ejecutar, eventos } = preparar();

    await assert.rejects(
      ejecutar({ ...DATOS, numero_pagina }),
      (error) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'La página indicada no existe en el plano.',
        );
        return true;
      },
    );

    assert.deepEqual(eventos, ['acceso', 'plano']);
  }
});

test('IncidenciasCreacion: propaga el fallo de actividad sin confirmar', async () => {
  const original = new Error('Falló el historial');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso', 'plano', 'insertar', 'actividad',
  ]);
});