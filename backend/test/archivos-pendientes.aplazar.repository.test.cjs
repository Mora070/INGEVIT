require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const CLAVE =
  'fotografias/10000000-0000-4000-8000-000000000001.webp';

test(
  'aplazar: parametriza la clave y la demora y devuelve true',
  async () => {
    const llamadas = [];
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.aplazar(
      {
        async query(sql, valores) {
          llamadas.push({ sql, valores });
          return { rowCount: 1, rows: [] };
        },
      },
      CLAVE,
      60,
    );

    assert.equal(resultado, true);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].valores, [CLAVE, 60]);
    assert.equal(llamadas[0].sql.includes(CLAVE), false);
    assert.match(llamadas[0].sql, /\$1\b/);
    assert.match(llamadas[0].sql, /\$2\b/);
  },
);

test(
  'aplazar: devuelve false cuando la tarea ya no existe',
  async () => {
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.aplazar(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      CLAVE,
      60,
    );

    assert.equal(resultado, false);
  },
);

const demorasInvalidas = [
  ['cero', 0],
  ['negativa', -1],
  ['fraccionaria', 1.5],
  ['texto', '60'],
  ['infinita', Infinity],
  ['entero no seguro', Number.MAX_SAFE_INTEGER + 1],
];

for (const [descripcion, demora] of demorasInvalidas) {
  test(
    `aplazar: rechaza una demora ${descripcion} antes de consultar`,
    async () => {
      let consultas = 0;
      const repositorio = new ArchivosPendientesRepository();

      await assert.rejects(
        () =>
          repositorio.aplazar(
            {
              async query() {
                consultas += 1;
              },
            },
            CLAVE,
            demora,
          ),
        {
          message:
            'La demora del reintento debe ser un número entero positivo de segundos.',
        },
      );

      assert.equal(consultas, 0);
    },
  );
}

test(
  'aplazar: rechaza una clave inválida antes de consultar',
  async () => {
    let consultas = 0;
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.aplazar(
          {
            async query() {
              consultas += 1;
            },
          },
          '../archivo.webp',
          60,
        ),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );

    assert.equal(consultas, 0);
  },
);

test(
  'aplazar: propaga el error de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.aplazar(
          {
            async query() {
              throw errorEsperado;
            },
          },
          CLAVE,
          60,
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);

test(
  'aplazar: rechaza un resultado de actualización indeterminado',
  async () => {
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.aplazar(
          {
            async query() {
              return { rowCount: null, rows: [] };
            },
          },
          CLAVE,
          60,
        ),
      {
        message:
          'No se pudo determinar el resultado del aplazamiento de la tarea.',
      },
    );
  },
);