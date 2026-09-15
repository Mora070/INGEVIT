require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosRepository,
} = require('../dist/modules/planos/planos.repository');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';

test('PlanosRepository.eliminar: utiliza ambos identificadores y devuelve el registro eliminado', async () => {
  const repository = new PlanosRepository();

  const fila = {
    id_plano: PLANO,
    id_proyecto: PROYECTO,
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    titulo: 'Plano',
    descripcion: '',
    url: '/plano.pdf',
    s3_key: `planos/${PLANO}.pdf`,
    mime_type: 'application/pdf',
    fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
  };

  let consultas = 0;

  const resultado = await repository.eliminar(
    {
      async query(sql, valores) {
        consultas += 1;

        assert.deepEqual(valores, [PROYECTO, PLANO]);
        assert.match(sql, /DELETE FROM obra\.planos/i);
        assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
        assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);
        assert.match(sql, /RETURNING[\s\S]*s3_key/i);

        assert.equal(sql.includes(PROYECTO), false);
        assert.equal(sql.includes(PLANO), false);

        return { rowCount: 1, rows: [fila] };
      },
    },
    PROYECTO,
    PLANO,
  );

  assert.equal(consultas, 1);
  assert.strictEqual(resultado, fila);
});

test('PlanosRepository.eliminar: devuelve null si no existe en el proyecto', async () => {
  const repository = new PlanosRepository();

  const resultado = await repository.eliminar(
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

test('PlanosRepository.eliminar: propaga el error original de PostgreSQL', async () => {
  const repository = new PlanosRepository();
  const original = new Error('Falló la eliminación');

  await assert.rejects(
    repository.eliminar(
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

test('PlanosRepository.eliminar: rechaza resultados inconsistentes', async () => {
  const repository = new PlanosRepository();

  for (const resultado of [
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [] },
    { rowCount: 0, rows: [{}] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repository.eliminar(
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
          'La eliminación del plano devolvió un resultado inesperado.',
      },
    );
  }
});