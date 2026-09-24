require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

function crearDatos(cambios = {}) {
  return {
    id_proyecto: '20000000-0000-4000-8000-000000000001',
    id_creador: '10000000-0000-4000-8000-000000000001',
    titulo: "Fisura'); DELETE FROM obra.incidencias; --",
    descripcion: 'Sector seleccionado en el mapa.',
    prioridad: 'ALTA',
    latitud: 4.711,
    longitud: -74.0721,
    ...cambios,
  };
}

function crearRegistro(datos) {
  return {
    id_incidencia: '30000000-0000-4000-8000-000000000001',
    id_proyecto: datos.id_proyecto,
    id_creador: datos.id_creador,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    prioridad: datos.prioridad,
    estado: 'PENDIENTE',
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: String(datos.latitud),
    longitud: String(datos.longitud),
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
  };
}

test('crearEnMapa: parametriza los datos y establece el contexto de mapa', async () => {
  const repositorio = new IncidenciasRepository();
  const datos = crearDatos();
  const copia = { ...datos };
  const registro = crearRegistro(datos);
  let consultas = 0;

  const resultado = await repositorio.crearEnMapa({
    async query(sql, valores) {
      consultas += 1;

      assert.deepEqual(valores, [
        datos.id_proyecto,
        datos.id_creador,
        datos.titulo,
        datos.descripcion,
        datos.prioridad,
        datos.latitud,
        datos.longitud,
      ]);

      assert.equal(sql.includes(datos.titulo), false);
      assert.equal(sql.includes(datos.descripcion), false);
      assert.match(sql, /INSERT INTO obra\.incidencias/i);

      const normalizado = sql.replace(/\s+/g, ' ');

      // La ubicación de plano no procede de parámetros externos.
      assert.match(
        normalizado,
        /NULL,\s*NULL,\s*NULL,\s*NULL,\s*'PENDIENTE'/,
      );

      assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK)\b/i);

      return { rowCount: 1, rows: [registro] };
    },
  }, datos);

  assert.equal(consultas, 1);
  assert.strictEqual(resultado, registro);
  assert.deepEqual(datos, copia);
});

test('crearEnMapa: conserva cero en ambas coordenadas', async () => {
  const repositorio = new IncidenciasRepository();
  const datos = crearDatos({ latitud: 0, longitud: 0 });
  const registro = crearRegistro(datos);

  const resultado = await repositorio.crearEnMapa({
    async query(sql, valores) {
      assert.equal(valores[5], 0);
      assert.equal(valores[6], 0);

      return { rowCount: 1, rows: [registro] };
    },
  }, datos);

  assert.equal(resultado.latitud, '0');
  assert.equal(resultado.longitud, '0');
});

test('crearEnMapa: propaga errores de PostgreSQL sin reintentar', async () => {
  const repositorio = new IncidenciasRepository();
  const original = Object.assign(
    new Error('Proyecto inexistente simulado.'),
    { code: '23503' },
  );
  let consultas = 0;

  await assert.rejects(
    repositorio.crearEnMapa({
      async query() {
        consultas += 1;
        throw original;
      },
    }, crearDatos()),
    (error) => error === original,
  );

  assert.equal(consultas, 1);
});

test('crearEnMapa: rechaza resultados inconsistentes', async () => {
  const repositorio = new IncidenciasRepository();
  const datos = crearDatos();
  const registro = crearRegistro(datos);

  for (const respuesta of [
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [] },
    { rowCount: 0, rows: [registro] },
    { rowCount: null, rows: [registro] },
    { rowCount: 1, rows: [registro, registro] },
    { rowCount: 2, rows: [registro, registro] },
  ]) {
    await assert.rejects(
      repositorio.crearEnMapa({
        async query() {
          return respuesta;
        },
      }, datos),
      {
        message:
          'La creación de la incidencia de mapa no devolvió exactamente un registro.',
      },
    );
  }
});