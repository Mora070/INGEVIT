require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasPlanoRepository,
} = require('../dist/modules/incidencias/incidencias-plano.repository');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';

test('IncidenciasPlano: consulta ambos identificadores y bloquea el plano', async () => {
  const repository = new IncidenciasPlanoRepository();
  let consultas = 0;

  const paginas = await repository.bloquearDisponible(
    {
      async query(sql, valores) {
        consultas += 1;

        assert.deepEqual(valores, [PROYECTO, PLANO]);
        assert.equal(sql.includes(PROYECTO), false);
        assert.equal(sql.includes(PLANO), false);
        assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
        assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);
        assert.match(sql, /FOR SHARE/i);

        return {
          rowCount: 1,
          rows: [{ numero_paginas: 3 }],
        };
      },
    },
    PROYECTO,
    PLANO,
  );

  assert.equal(paginas, 3);
  assert.equal(consultas, 1);
});

test('IncidenciasPlano: devuelve null cuando el plano no existe en el proyecto', async () => {
  const repository = new IncidenciasPlanoRepository();

  const resultado = await repository.bloquearDisponible(
    {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    },
    PROYECTO,
    PLANO,
  );

  assert.equal(resultado, null);
});

test('IncidenciasPlano: rechaza cantidades de páginas inválidas', async () => {
  const repository = new IncidenciasPlanoRepository();

  for (const numero_paginas of [
    null,
    undefined,
    '3',
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    2147483648,
  ]) {
    await assert.rejects(
      repository.bloquearDisponible(
        {
          async query() {
            return {
              rowCount: 1,
              rows: [{ numero_paginas }],
            };
          },
        },
        PROYECTO,
        PLANO,
      ),
      {
        message:
          'No se pudo determinar el número de páginas del plano.',
      },
    );
  }
});

test('IncidenciasPlano: rechaza resultados inconsistentes', async () => {
  const repository = new IncidenciasPlanoRepository();

  for (const resultado of [
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [{ numero_paginas: 2 }] },
    { rowCount: 0, rows: [{ numero_paginas: 2 }] },
    {
      rowCount: 2,
      rows: [{ numero_paginas: 2 }, { numero_paginas: 3 }],
    },
  ]) {
    await assert.rejects(
      repository.bloquearDisponible(
        {
          async query() {
            return resultado;
          },
        },
        PROYECTO,
        PLANO,
      ),
      {
        message:
          'No se pudo determinar el número de páginas del plano.',
      },
    );
  }
});

test('IncidenciasPlano: propaga el error original de PostgreSQL', async () => {
  const repository = new IncidenciasPlanoRepository();
  const original = new Error('Falló la consulta');

  await assert.rejects(
    repository.bloquearDisponible(
      {
        async query() {
          throw original;
        },
      },
      PROYECTO,
      PLANO,
    ),
    (error) => error === original,
  );
});