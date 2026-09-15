require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosRepository,
} = require('../dist/modules/planos/planos.repository');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';

test('PlanosRepository.actualizarDatos: parametriza los campos y ambos identificadores', async () => {
  const repository = new PlanosRepository();
  const datos = {
    titulo: "Plano'; DELETE FROM obra.planos; --",
    descripcion: '',
  };
  const copia = { ...datos };

  const fila = {
    id_plano: PLANO,
    id_proyecto: PROYECTO,
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    ...datos,
    url: '/plano.pdf',
    s3_key: `planos/${PLANO}.pdf`,
    mime_type: 'application/pdf',
    fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
  };

  let consultas = 0;

  const client = {
    async query(sql, valores) {
      consultas += 1;

      assert.deepEqual(valores, [
        PROYECTO,
        PLANO,
        datos.titulo,
        datos.descripcion,
      ]);

      assert.equal(sql.includes(datos.titulo), false);
      assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
      assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);

      // El SET debe contener únicamente los campos descriptivos.
      const asignaciones = sql.match(/\bSET\b([\s\S]*?)\bWHERE\b/i);
      assert.ok(asignaciones);

      assert.equal(
        asignaciones[1].replace(/\s+/g, ' ').trim(),
        'titulo = $3, descripcion = $4',
      );

      return { rowCount: 1, rows: [fila] };
    },
  };

  const resultado = await repository.actualizarDatos(
    client,
    PROYECTO,
    PLANO,
    datos,
  );

  assert.strictEqual(resultado, fila);
  assert.equal(consultas, 1);
  assert.deepEqual(datos, copia);
});

test('PlanosRepository.actualizarDatos: devuelve null cuando no existe en el proyecto', async () => {
  const repository = new PlanosRepository();

  const resultado = await repository.actualizarDatos(
    {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    },
    PROYECTO,
    PLANO,
    { titulo: 'Nuevo título', descripcion: '' },
  );

  assert.equal(resultado, null);
});

test('PlanosRepository.actualizarDatos: propaga el error original', async () => {
  const repository = new PlanosRepository();
  const original = new Error('Error de PostgreSQL');

  await assert.rejects(
    repository.actualizarDatos(
      {
        async query() {
          throw original;
        },
      },
      PROYECTO,
      PLANO,
      { titulo: 'Nuevo título', descripcion: '' },
    ),
    (error) => error === original,
  );
});

test('PlanosRepository.actualizarDatos: rechaza resultados inconsistentes', async () => {
  const repository = new PlanosRepository();

  for (const resultado of [
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [] },
    { rowCount: 0, rows: [{}] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repository.actualizarDatos(
        {
          async query() {
            return resultado;
          },
        },
        PROYECTO,
        PLANO,
        { titulo: 'Nuevo título', descripcion: '' },
      ),
      {
        message:
          'La actualización del plano devolvió un resultado inesperado.',
      },
    );
  }
});