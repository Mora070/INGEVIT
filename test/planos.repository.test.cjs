require('reflect-metadata');

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  PlanosRepository,
} = require('../dist/modules/planos/planos.repository');

function crearDatos(cambios = {}) {
  return {
    id_proyecto: '20000000-0000-4000-8000-000000000001',
    id_usuario_subida: '10000000-0000-4000-8000-000000000001',
    titulo: 'Plano estructural',
    descripcion: 'Primer nivel',
    url: '/api/proyectos/20000000-0000-4000-8000-000000000001/planos/archivos/30000000-0000-4000-8000-000000000001.pdf',
    s3_key: 'planos/30000000-0000-4000-8000-000000000001.pdf',
    ...cambios,
  };
}

function crearFila(datos) {
  return {
    id_plano: '40000000-0000-4000-8000-000000000001',
    ...datos,
    mime_type: 'application/pdf',
    fecha_subida: new Date('2026-09-14T12:00:00.000Z'),
  };
}

test('PlanosRepository.crear: parametriza los datos y devuelve el plano', async () => {
  const repository = new PlanosRepository();

  const datos = crearDatos({
    titulo: "Plano'); DROP TABLE obra.planos; --",
  });

  const fila = crearFila(datos);
  const llamadas = [];

  const client = {
    async query(sql, valores) {
      llamadas.push({ sql, valores });

      return {
        rowCount: 1,
        rows: [fila],
      };
    },
  };

  const resultado = await repository.crear(client, datos);

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);

  const { sql, valores } = llamadas[0];

  assert.match(sql, /INSERT INTO obra\.planos/i);
  assert.match(sql, /RETURNING/i);
  assert.match(sql, /'application\/pdf'/);
  assert.equal(sql.includes(datos.titulo), false);

  assert.deepEqual(valores, [
    datos.id_proyecto,
    datos.id_usuario_subida,
    datos.titulo,
    datos.descripcion,
    datos.url,
    datos.s3_key,
  ]);
});

test('PlanosRepository.crear: conserva una descripción vacía', async () => {
  const repository = new PlanosRepository();
  const datos = crearDatos({ descripcion: '' });
  const copia = { ...datos };

  const client = {
    async query(_sql, valores) {
      assert.equal(valores[3], '');

      return {
        rowCount: 1,
        rows: [crearFila(datos)],
      };
    },
  };

  const resultado = await repository.crear(client, datos);

  assert.equal(resultado.descripcion, '');
  assert.deepEqual(datos, copia);
});

test('PlanosRepository.crear: propaga el error original de PostgreSQL', async () => {
  const repository = new PlanosRepository();
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    repository.crear(client, crearDatos()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('PlanosRepository.crear: rechaza un resultado inconsistente', async () => {
  const repository = new PlanosRepository();
  const datos = crearDatos();
  const fila = crearFila(datos);

  const resultadosInvalidos = [
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [fila] },
    { rowCount: 2, rows: [fila, fila] },
  ];

  for (const resultado of resultadosInvalidos) {
    const client = {
      async query() {
        return resultado;
      },
    };

    await assert.rejects(
      repository.crear(client, datos),
      {
        message:
          'La creación del plano no devolvió exactamente un registro.',
      },
    );
  }
});