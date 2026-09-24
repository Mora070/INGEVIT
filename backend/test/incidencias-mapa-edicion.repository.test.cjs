require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

const {
  ActualizarIncidenciaDto,
} = require('../dist/modules/incidencias/dto/actualizar-incidencia.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const INCIDENCIA = '30000000-0000-4000-8000-000000000001';

const DATOS = {
  titulo: "Fisura revisada'); SELECT 1; --",
  descripcion: 'Reparación verificada.',
  prioridad: 'BAJA',
  estado: 'SOLUCIONADA',
};

test('actualizarDatosEnMapa: parametriza y limita los campos modificados', async () => {
  const repositorio = new IncidenciasRepository();
  const fila = {
    id_incidencia: INCIDENCIA,
    id_proyecto: PROYECTO,
    id_creador: '10000000-0000-4000-8000-000000000001',
    ...DATOS,
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: '4.711',
    longitud: '-74.0721',
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
  };

  let consultas = 0;

  const resultado = await repositorio.actualizarDatosEnMapa(
    {
      async query(sql, valores) {
        consultas += 1;

        assert.deepEqual(valores, [
          PROYECTO,
          INCIDENCIA,
          DATOS.titulo,
          DATOS.descripcion,
          DATOS.prioridad,
          DATOS.estado,
        ]);

        assert.equal(sql.includes(DATOS.titulo), false);
        assert.match(sql, /id_proyecto\s*=\s*\$1::uuid/i);
        assert.match(sql, /id_incidencia\s*=\s*\$2::uuid/i);
        assert.match(sql, /id_plano\s+IS\s+NULL/i);

        const asignaciones = sql.match(/\bSET\b([\s\S]*?)\bWHERE\b/i);
        assert.ok(asignaciones);

        assert.equal(
          asignaciones[1].replace(/\s+/g, ' ').trim(),
          'titulo = $3, descripcion = $4, prioridad = $5, estado = $6',
        );

        assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK)\b/i);

        return { rowCount: 1, rows: [fila] };
      },
    },
    PROYECTO,
    INCIDENCIA,
    DATOS,
  );

  assert.equal(consultas, 1);
  assert.strictEqual(resultado, fila);
});

test('actualizarDatosEnMapa: devuelve null cuando no hay coincidencia', async () => {
  const repositorio = new IncidenciasRepository();

  const resultado = await repositorio.actualizarDatosEnMapa(
    {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    },
    PROYECTO,
    INCIDENCIA,
    DATOS,
  );

  assert.equal(resultado, null);
});

test('actualizarDatosEnMapa: propaga errores sin reintentar', async () => {
  const repositorio = new IncidenciasRepository();
  const original = new Error('Fallo de PostgreSQL');
  let consultas = 0;

  await assert.rejects(
    repositorio.actualizarDatosEnMapa(
      {
        async query() {
          consultas += 1;
          throw original;
        },
      },
      PROYECTO,
      INCIDENCIA,
      DATOS,
    ),
    (error) => error === original,
  );

  assert.equal(consultas, 1);
});

test('actualizarDatosEnMapa: rechaza respuestas inconsistentes', async () => {
  const repositorio = new IncidenciasRepository();

  for (const respuesta of [
    { rowCount: 1, rows: [] },
    { rowCount: 0, rows: [{}] },
    { rowCount: null, rows: [{}] },
    { rowCount: 1, rows: [{}, {}] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repositorio.actualizarDatosEnMapa(
        {
          async query() {
            return respuesta;
          },
        },
        PROYECTO,
        INCIDENCIA,
        DATOS,
      ),
      /actualización de la incidencia de mapa/,
    );
  }
});

test('edición de mapa DTO: rechaza cambios de ubicación geográfica', async () => {
  for (const campo of ['latitud', 'longitud']) {
    await assert.rejects(
      createValidationPipe().transform(
        { ...DATOS, [campo]: 0 },
        {
          type: 'body',
          metatype: ActualizarIncidenciaDto,
        },
      ),
      (error) => error.getStatus() === 400,
    );
  }
});