require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const CLAVE =
  'fotografias/10000000-0000-4000-8000-000000000001.webp';

test(
  'bloquearSiguiente: devuelve la tarea seleccionada',
  async () => {
    const tarea = {
      s3_key: CLAVE,
      fecha_creacion: new Date('2026-09-14T12:00:00.000Z'),
    };

    let consultas = 0;

    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.bloquearSiguiente({
      async query() {
        consultas += 1;
        return { rowCount: 1, rows: [tarea] };
      },
    });

    assert.equal(consultas, 1);
    assert.strictEqual(resultado, tarea);
  },
);

test(
  'bloquearSiguiente: devuelve null cuando no hay tareas disponibles',
  async () => {
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.bloquearSiguiente({
      async query() {
        return { rowCount: 0, rows: [] };
      },
    });

    assert.equal(resultado, null);
  },
);

test(
  'bloquearSiguiente: propaga el error de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de selección');
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.bloquearSiguiente({
          async query() {
            throw errorEsperado;
          },
        }),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);

test(
  'completar: envía la clave como parámetro y retira una tarea',
  async () => {
    const llamadas = [];
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.completar(
      {
        async query(sql, valores) {
          llamadas.push({ sql, valores });
          return { rowCount: 1, rows: [] };
        },
      },
      CLAVE,
    );

    assert.equal(resultado, undefined);
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].valores, [CLAVE]);
    assert.equal(llamadas[0].sql.includes(CLAVE), false);
    assert.match(llamadas[0].sql, /\$1\b/);
  },
);

test(
  'completar: rechaza una clave inválida antes de consultar',
  async () => {
    let consultas = 0;
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.completar(
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

test(
  'completar: detecta que la tarea esperada no existe',
  async () => {
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.completar(
          {
            async query() {
              return { rowCount: 0, rows: [] };
            },
          },
          CLAVE,
        ),
      {
        message:
          'No se encontró la tarea de eliminación que debía completarse.',
      },
    );
  },
);

test(
  'completar: propaga el error de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de eliminación');
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.completar(
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