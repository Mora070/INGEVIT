require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const CLAVE_ORIGINAL =
  'fotografias/10000000-0000-4000-8000-000000000001.jpeg';

const CLAVE_OPTIMIZADA =
  'fotografias/20000000-0000-4000-8000-000000000002.webp';

test(
  'pendientes registrar: envía ambas claves como un parámetro de arreglo',
  async () => {
    const llamadas = [];

    const client = {
      async query(sql, valores) {
        llamadas.push({ sql, valores });
        return { rowCount: 2, rows: [] };
      },
    };

    const repositorio = new ArchivosPendientesRepository();

    await repositorio.registrar(client, [
      CLAVE_ORIGINAL,
      CLAVE_OPTIMIZADA,
    ]);

    assert.equal(llamadas.length, 1);

    const { sql, valores } = llamadas[0];

    assert.deepEqual(valores, [
      [CLAVE_ORIGINAL, CLAVE_OPTIMIZADA],
    ]);

    assert.equal(sql.includes(CLAVE_ORIGINAL), false);
    assert.equal(sql.includes(CLAVE_OPTIMIZADA), false);
    assert.match(sql, /\$1\b/);
  },
);

test(
  'pendientes registrar: una lista vacía no ejecuta consultas',
  async () => {
    let consultas = 0;

    const repositorio = new ArchivosPendientesRepository();

    await repositorio.registrar(
      {
        async query() {
          consultas += 1;
        },
      },
      [],
    );

    assert.equal(consultas, 0);
  },
);

test(
  'pendientes registrar: valida toda la lista antes de insertar',
  async () => {
    let consultas = 0;

    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.registrar(
          {
            async query() {
              consultas += 1;
            },
          },
          [
            CLAVE_ORIGINAL,
            '../archivo-fuera-del-almacenamiento.jpeg',
          ],
        ),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );

    // La primera clave válida tampoco debe haberse insertado.
    assert.equal(consultas, 0);
  },
);

test(
  'pendientes registrar: conserva el arreglo recibido sin modificarlo',
  async () => {
    const claves = Object.freeze([
      CLAVE_ORIGINAL,
      CLAVE_OPTIMIZADA,
    ]);

    const repositorio = new ArchivosPendientesRepository();

    await repositorio.registrar(
      {
        async query() {
          return { rowCount: 2, rows: [] };
        },
      },
      claves,
    );

    assert.deepEqual(claves, [
      CLAVE_ORIGINAL,
      CLAVE_OPTIMIZADA,
    ]);
  },
);

test(
  'pendientes registrar: admite una respuesta sin nuevas filas insertadas',
  async () => {
    /*
     * PostgreSQL puede devolver cero inserciones cuando todas
     * las claves ya estaban pendientes.
     *
     * La deduplicación real se comprobará en integración.
     */
    const repositorio = new ArchivosPendientesRepository();

    const resultado = await repositorio.registrar(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      [CLAVE_ORIGINAL],
    );

    assert.equal(resultado, undefined);
  },
);

test(
  'pendientes registrar: propaga los errores de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    const repositorio = new ArchivosPendientesRepository();

    await assert.rejects(
      () =>
        repositorio.registrar(
          {
            async query() {
              throw errorEsperado;
            },
          },
          [CLAVE_ORIGINAL, CLAVE_OPTIMIZADA],
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);