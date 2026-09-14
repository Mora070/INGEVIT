require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasRepository,
} = require('../dist/modules/fotografias/fotografias.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';

test(
  'eliminar fotografía: parametriza la consulta y devuelve el registro con ambas claves',
  async () => {
    const fotografia = {
      id_fotografia: ID_FOTOGRAFIA,
      id_proyecto: ID_PROYECTO,
      id_usuario_subida: '10000000-0000-4000-8000-000000000001',
      titulo: 'Avance de obra',
      url: '/fotografia.webp',
      s3_key:
        'fotografias/40000000-0000-4000-8000-000000000004.webp',
      original_s3_key:
        'fotografias/50000000-0000-4000-8000-000000000005.jpeg',
      fecha_subida: new Date('2026-09-14T12:00:00.000Z'),
    };

    const llamadas = [];

    const client = {
      async query(sql, valores) {
        llamadas.push({ sql, valores });

        return {
          rowCount: 1,
          rows: [fotografia],
        };
      },
    };

    const repositorio = new FotografiasRepository();

    const resultado = await repositorio.eliminar(
      client,
      ID_PROYECTO,
      ID_FOTOGRAFIA,
    );

    assert.strictEqual(resultado, fotografia);
    assert.equal(resultado.s3_key, fotografia.s3_key);
    assert.equal(
      resultado.original_s3_key,
      fotografia.original_s3_key,
    );

    assert.equal(llamadas.length, 1);

    const { sql, valores } = llamadas[0];

    assert.deepEqual(valores, [
      ID_PROYECTO,
      ID_FOTOGRAFIA,
    ]);

    assert.equal(sql.includes(ID_PROYECTO), false);
    assert.equal(sql.includes(ID_FOTOGRAFIA), false);
    assert.match(sql, /\$1\b/);
    assert.match(sql, /\$2\b/);
  },
);

test(
  'eliminar fotografía: devuelve null si no existe un registro coincidente',
  async () => {
    const repositorio = new FotografiasRepository();

    const resultado = await repositorio.eliminar(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      ID_PROYECTO,
      ID_FOTOGRAFIA,
    );

    assert.equal(resultado, null);
  },
);

test(
  'eliminar fotografía: mantiene una entrada maliciosa fuera del SQL',
  async () => {
    const idMalicioso = `${ID_FOTOGRAFIA}' OR TRUE; --`;
    let consultaRecibida;

    const repositorio = new FotografiasRepository();

    await repositorio.eliminar(
      {
        async query(sql, valores) {
          consultaRecibida = { sql, valores };
          return { rowCount: 0, rows: [] };
        },
      },
      ID_PROYECTO,
      idMalicioso,
    );

    assert.equal(
      consultaRecibida.sql.includes(idMalicioso),
      false,
    );

    assert.deepEqual(consultaRecibida.valores, [
      ID_PROYECTO,
      idMalicioso,
    ]);
  },
);

test(
  'eliminar fotografía: propaga el error de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    const repositorio = new FotografiasRepository();

    await assert.rejects(
      () =>
        repositorio.eliminar(
          {
            async query() {
              throw errorEsperado;
            },
          },
          ID_PROYECTO,
          ID_FOTOGRAFIA,
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);

test(
  'eliminar fotografía: detecta una respuesta sin el registro eliminado',
  async () => {
    const repositorio = new FotografiasRepository();

    await assert.rejects(
      () =>
        repositorio.eliminar(
          {
            async query() {
              return { rowCount: 1, rows: [] };
            },
          },
          ID_PROYECTO,
          ID_FOTOGRAFIA,
        ),
      {
        message:
          'La eliminación de la fotografía no devolvió el registro esperado.',
      },
    );
  },
);