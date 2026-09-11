require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasDescargaRepository,
} = require('../dist/modules/fotografias/fotografias-descarga.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const CLAVE =
  'fotografias/30000000-0000-4000-8000-000000000003.webp';

test(
  'buscarOptimizadaDisponible: parametriza la consulta y devuelve la clave',
  async () => {
    const llamadas = [];

    const database = {
      async query(sql, valores) {
        llamadas.push({ sql, valores });

        return {
          rows: [{ s3_key: CLAVE }],
          rowCount: 1,
        };
      },
    };

    const repositorio = new FotografiasDescargaRepository(database);

    const resultado = await repositorio.buscarOptimizadaDisponible(
      ID_PROYECTO,
      ID_USUARIO,
      CLAVE,
    );

    assert.deepEqual(resultado, { s3_key: CLAVE });
    assert.equal(llamadas.length, 1);

    const { sql, valores } = llamadas[0];

    assert.deepEqual(valores, [
      ID_PROYECTO,
      ID_USUARIO,
      CLAVE,
    ]);

    // Los valores externos no deben interpolarse en el texto SQL.
    for (const valor of valores) {
      assert.equal(sql.includes(valor), false);
    }

    assert.match(sql, /\$1\b/);
    assert.match(sql, /\$2\b/);
    assert.match(sql, /\$3\b/);
  },
);

test(
  'buscarOptimizadaDisponible: devuelve null cuando no hay una fotografía disponible',
  async () => {
    const database = {
      async query() {
        return {
          rows: [],
          rowCount: 0,
        };
      },
    };

    const repositorio = new FotografiasDescargaRepository(database);

    const resultado = await repositorio.buscarOptimizadaDisponible(
      ID_PROYECTO,
      ID_USUARIO,
      CLAVE,
    );

    assert.equal(resultado, null);
  },
);

test(
  'buscarOptimizadaDisponible: conserva una entrada maliciosa fuera del SQL',
  async () => {
    const claveMaliciosa =
      "fotografias/imagen.webp' OR TRUE; --";

    let consultaRecibida;

    const database = {
      async query(sql, valores) {
        consultaRecibida = { sql, valores };

        return {
          rows: [],
          rowCount: 0,
        };
      },
    };

    const repositorio = new FotografiasDescargaRepository(database);

    const resultado = await repositorio.buscarOptimizadaDisponible(
      ID_PROYECTO,
      ID_USUARIO,
      claveMaliciosa,
    );

    assert.equal(resultado, null);
    assert.equal(
      consultaRecibida.sql.includes(claveMaliciosa),
      false,
    );

    assert.deepEqual(consultaRecibida.valores, [
      ID_PROYECTO,
      ID_USUARIO,
      claveMaliciosa,
    ]);
  },
);

test(
  'buscarOptimizadaDisponible: propaga un error de PostgreSQL sin convertirlo en ausencia',
  async () => {
    const errorEsperado = new Error(
      'Fallo simulado de PostgreSQL',
    );

    const database = {
      async query() {
        throw errorEsperado;
      },
    };

    const repositorio = new FotografiasDescargaRepository(database);

    await assert.rejects(
      () =>
        repositorio.buscarOptimizadaDisponible(
          ID_PROYECTO,
          ID_USUARIO,
          CLAVE,
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);