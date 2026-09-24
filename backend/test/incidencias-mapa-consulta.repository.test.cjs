require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasMapaConsultaRepository,
} = require('../dist/modules/incidencias/incidencias-mapa-consulta.repository');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

function crearRegistro() {
  return {
    id_incidencia: '30000000-0000-4000-8000-000000000001',
    id_proyecto: PROYECTO,
    id_creador: USUARIO,
    titulo: 'Incidencia de mapa',
    descripcion: 'Revisar el punto.',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: '4.711',
    longitud: '-74.0721',
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
  };
}

function filaVacia(total) {
  return {
    ...Object.fromEntries(
      Object.keys(crearRegistro()).map((campo) => [campo, null]),
    ),
    total,
  };
}

function preparar(filas, error) {
  const consultas = [];

  const repositorio = new IncidenciasMapaConsultaRepository({
    async query(sql, valores) {
      consultas.push({ sql, valores });

      if (error) throw error;

      return { rows: filas, rowCount: filas.length };
    },
  });

  return {
    consultas,
    ejecutar: () =>
      repositorio.listarDisponibles(PROYECTO, USUARIO, 3, 20),
  };
}

test('listado de mapa: parametriza la página y separa el conteo', async () => {
  const registro = crearRegistro();
  const escenario = preparar([{ ...registro, total: '45' }]);

  assert.deepEqual(await escenario.ejecutar(), {
    incidencias: [registro],
    total: 45,
  });

  assert.equal(escenario.consultas.length, 1);
  assert.deepEqual(escenario.consultas[0].valores, [
    PROYECTO,
    USUARIO,
    20,
    40,
  ]);

  assert.equal(escenario.consultas[0].sql.includes(PROYECTO), false);
  assert.equal(escenario.consultas[0].sql.includes(USUARIO), false);
});

test('listado de mapa: devuelve null cuando no hay proyecto disponible', async () => {
  const escenario = preparar([]);

  assert.equal(await escenario.ejecutar(), null);
});

test('listado de mapa: distingue un proyecto accesible sin incidencias', async () => {
  const escenario = preparar([filaVacia('0')]);

  assert.deepEqual(await escenario.ejecutar(), {
    incidencias: [],
    total: 0,
  });
});

test('listado de mapa: conserva el total cuando la página está vacía', async () => {
  const escenario = preparar([filaVacia('35')]);

  assert.deepEqual(await escenario.ejecutar(), {
    incidencias: [],
    total: 35,
  });
});

test('listado de mapa: rechaza conteos inválidos o no representables', async () => {
  for (const total of [
    null,
    undefined,
    5,
    '',
    ' ',
    '-1',
    '1.5',
    '1e2',
    '2\n',
    '2\r',
    '9007199254740992',
  ]) {
    const escenario = preparar([filaVacia(total)]);

    await assert.rejects(
      escenario.ejecutar(),
      /conteo de incidencias de mapa/,
    );
  }
});

test('listado de mapa: propaga errores de PostgreSQL sin reintentar', async () => {
  const original = new Error('Fallo de consulta');
  const escenario = preparar([], original);

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error === original,
  );

  assert.equal(escenario.consultas.length, 1);
});