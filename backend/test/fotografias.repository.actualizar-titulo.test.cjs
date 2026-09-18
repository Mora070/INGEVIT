require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasRepository,
} = require('../dist/modules/fotografias/fotografias.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';

test(
  'actualizarTitulo: parametriza la consulta y devuelve la fotografía actualizada',
  async () => {
    const titulo = 'Avance de cimentación';

    const fotografia = {
      id_fotografia: ID_FOTOGRAFIA,
      id_proyecto: ID_PROYECTO,
      id_usuario_subida: '10000000-0000-4000-8000-000000000001',
      titulo,
      url: '/fotografia.webp',
      s3_key: 'fotografias/40000000-0000-4000-8000-000000000004.webp',
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

    const resultado = await repositorio.actualizarTitulo(
      client,
      ID_PROYECTO,
      ID_FOTOGRAFIA,
      titulo,
    );

    assert.strictEqual(resultado, fotografia);
    assert.equal(llamadas.length, 1);

    const { sql, valores } = llamadas[0];

    assert.deepEqual(valores, [
      ID_PROYECTO,
      ID_FOTOGRAFIA,
      titulo,
    ]);

    for (const valor of valores) {
      assert.equal(sql.includes(valor), false);
    }

    assert.match(sql, /\$1\b/);
    assert.match(sql, /\$2\b/);
    assert.match(sql, /\$3\b/);
  },
);

test(
  'actualizarTitulo: devuelve null cuando no existe una fotografía coincidente',
  async () => {
    const repositorio = new FotografiasRepository();

    const resultado = await repositorio.actualizarTitulo(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      ID_PROYECTO,
      ID_FOTOGRAFIA,
      'Nuevo título',
    );

    assert.equal(resultado, null);
  },
);

test(
  'actualizarTitulo: mantiene un título malicioso fuera del SQL',
  async () => {
    const titulo = "Obra'; DELETE FROM obra.fotografias; --";
    let consultaRecibida;

    const repositorio = new FotografiasRepository();

    await repositorio.actualizarTitulo(
      {
        async query(sql, valores) {
          consultaRecibida = { sql, valores };
          return { rowCount: 0, rows: [] };
        },
      },
      ID_PROYECTO,
      ID_FOTOGRAFIA,
      titulo,
    );

    assert.equal(consultaRecibida.sql.includes(titulo), false);
    assert.deepEqual(consultaRecibida.valores, [
      ID_PROYECTO,
      ID_FOTOGRAFIA,
      titulo,
    ]);
  },
);

test(
  'actualizarTitulo: propaga el error de PostgreSQL sin convertirlo en ausencia',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    const repositorio = new FotografiasRepository();

    await assert.rejects(
      () =>
        repositorio.actualizarTitulo(
          {
            async query() {
              throw errorEsperado;
            },
          },
          ID_PROYECTO,
          ID_FOTOGRAFIA,
          'Nuevo título',
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);

test(
  'actualizarTitulo: detecta una respuesta sin la fila actualizada',
  async () => {
    const repositorio = new FotografiasRepository();

    await assert.rejects(
      () =>
        repositorio.actualizarTitulo(
          {
            async query() {
              return { rowCount: 1, rows: [] };
            },
          },
          ID_PROYECTO,
          ID_FOTOGRAFIA,
          'Nuevo título',
        ),
      {
        message:
          'La actualización de la fotografía no devolvió el registro esperado.',
      },
    );
  },
);