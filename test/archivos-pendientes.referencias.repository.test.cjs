require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const CLAVE =
  'fotografias/10000000-0000-4000-8000-000000000001.webp';

test(
  'referencias fotografía: parametriza la consulta y devuelve true',
  async () => {
    const llamadas = [];
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.estaReferenciadoEnFotografias(
      {
        async query(sql, valores) {
          llamadas.push({ sql, valores });

          return {
            rowCount: 1,
            rows: [{ referenciado: true }],
          };
        },
      },
      CLAVE,
    );

    assert.equal(resultado, true);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].valores, [CLAVE]);
    assert.equal(llamadas[0].sql.includes(CLAVE), false);
    assert.match(llamadas[0].sql, /\$1\b/);
  },
);

test(
  'referencias fotografía: devuelve false cuando PostgreSQL confirma que no hay referencias',
  async () => {
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.estaReferenciadoEnFotografias(
      {
        async query() {
          return {
            rowCount: 1,
            rows: [{ referenciado: false }],
          };
        },
      },
      CLAVE,
    );

    assert.equal(resultado, false);
  },
);

test(
  'referencias fotografía: rechaza una clave inválida antes de consultar',
  async () => {
    let consultas = 0;
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.estaReferenciadoEnFotografias(
          {
            async query() {
              consultas += 1;
            },
          },
          '../archivo.webp',
        ),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );

    assert.equal(consultas, 0);
  },
);

const respuestasInvalidas = [
  [
    'respuesta sin filas',
    { rowCount: 0, rows: [] },
  ],
  [
    'valor nulo',
    { rowCount: 1, rows: [{ referenciado: null }] },
  ],
  [
    'texto en lugar de booleano',
    { rowCount: 1, rows: [{ referenciado: 'false' }] },
  ],
];

for (const [descripcion, respuesta] of respuestasInvalidas) {
  test(
    `referencias fotografía: rechaza ${descripcion}`,
    async () => {
      const repositorio = new ArchivosPendientesRepository();

      await assert.rejects(
        () =>
          repositorio.estaReferenciadoEnFotografias(
            {
              async query() {
                return respuesta;
              },
            },
            CLAVE,
          ),
        {
          message:
            'No se pudo comprobar si el archivo continúa referenciado.',
        },
      );
    },
  );
}

test(
  'referencias fotografía: propaga un error de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.estaReferenciadoEnFotografias(
          {
            async query() {
              throw errorEsperado;
            },
          },
          CLAVE,
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);