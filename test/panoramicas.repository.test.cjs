require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PanoramicasRepository,
} = require('../dist/modules/panoramicas/panoramicas.repository');

function crearDatos() {
  return {
    id_proyecto: '20000000-0000-4000-8000-000000000001',
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    titulo: "Sector norte'); SELECT 1; --",
    url: '/api/proyectos/proyecto/panoramicas/archivos/imagen.webp',
    s3_key: 'panoramicas/30000000-0000-4000-8000-000000000001.webp',
    mime_type: 'image/webp',
  };
}

test('PanoramicasRepository: parametriza la inserción y devuelve el registro', async () => {
  const repository = new PanoramicasRepository();
  const datos = crearDatos();
  const copia = { ...datos };

  const fila = {
    id_panoramica: '40000000-0000-4000-8000-000000000001',
    ...datos,
    fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
  };

  let consultas = 0;

  const resultado = await repository.crear(
    {
      async query(sql, valores) {
        consultas += 1;

        assert.match(sql, /INSERT INTO obra\.panoramicas/i);
        assert.match(sql, /RETURNING/i);
        assert.equal(sql.includes(datos.titulo), false);

        assert.deepEqual(valores, [
          datos.id_proyecto,
          datos.id_usuario_subida,
          datos.titulo,
          datos.url,
          datos.s3_key,
          datos.mime_type,
        ]);

        return { rowCount: 1, rows: [fila] };
      },
    },
    datos,
  );

  assert.strictEqual(resultado, fila);
  assert.equal(consultas, 1);
  assert.deepEqual(datos, copia);
});

test('PanoramicasRepository: propaga el error original de PostgreSQL', async () => {
  const repository = new PanoramicasRepository();
  const original = new Error('Falló la inserción');

  await assert.rejects(
    repository.crear(
      {
        async query() {
          throw original;
        },
      },
      crearDatos(),
    ),
    (error) => error === original,
  );
});

test('PanoramicasRepository: rechaza resultados inconsistentes', async () => {
  const repository = new PanoramicasRepository();

  for (const resultado of [
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [{}] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repository.crear(
        {
          async query() {
            return resultado;
          },
        },
        crearDatos(),
      ),
      {
        message:
          'La creación de la panorámica no devolvió exactamente un registro.',
      },
    );
  }
});