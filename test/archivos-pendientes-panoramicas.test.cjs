require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const {
  ArchivosPendientesService,
} = require('../dist/modules/almacenamiento/archivos-pendientes.service');

const CLAVE = 'panoramicas/20000000-0000-4000-8000-000000000002.webp';

test('Pendientes panorámicas: consulta referencias con parámetros', async () => {
  const repository = new ArchivosPendientesRepository();

  for (const referenciado of [true, false]) {
    const resultado = await repository.estaReferenciadoEnPanoramicas(
      {
        async query(sql, valores) {
          assert.deepEqual(valores, [CLAVE]);
          assert.equal(sql.includes(CLAVE), false);
          assert.match(sql, /FROM obra\.panoramicas/i);

          return {
            rowCount: 1,
            rows: [{ referenciado }],
          };
        },
      },
      CLAVE,
    );

    assert.equal(resultado, referenciado);
  }
});

test('Pendientes panorámicas: rechaza respuestas ambiguas', async () => {
  const repository = new ArchivosPendientesRepository();

  for (const resultado of [
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [{ referenciado: null }] },
    { rowCount: 1, rows: [{ referenciado: 'false' }] },
    { rowCount: null, rows: [{ referenciado: false }] },
  ]) {
    await assert.rejects(
      repository.estaReferenciadoEnPanoramicas(
        {
          async query() {
            return resultado;
          },
        },
        CLAVE,
      ),
      {
        message:
          'No se pudo comprobar si el archivo continúa referenciado.',
      },
    );
  }
});

function preparar({ referenciado = false, errorConsulta } = {}) {
  const client = {};
  const eventos = [];

  const service = new ArchivosPendientesService(
    {
      async withTransaction(operacion) {
        return operacion(client);
      },
    },
    {
      async bloquearSiguiente(conexion) {
        assert.strictEqual(conexion, client);
        return {
          s3_key: CLAVE,
          fecha_creacion: new Date(),
        };
      },

      async estaReferenciadoEnPanoramicas(conexion, clave) {
        assert.strictEqual(conexion, client);
        assert.equal(clave, CLAVE);
        eventos.push('referencias');

        if (errorConsulta) throw errorConsulta;
        return referenciado;
      },

      async estaReferenciadoEnFotografias() {
        assert.fail('No debe consultar referencias de fotografías.');
      },

      async estaReferenciadoEnPlanos() {
        assert.fail('No debe consultar referencias de planos.');
      },

      async completar(conexion, clave) {
        assert.strictEqual(conexion, client);
        assert.equal(clave, CLAVE);
        eventos.push('completar');
      },
    },
    {
      async eliminar(clave) {
        assert.equal(clave, CLAVE);
        eventos.push('eliminar');
      },
    },
  );

  return { service, eventos };
}

test('Pendientes panorámicas: elimina antes de completar la tarea', async () => {
  const { service, eventos } = preparar();

  assert.equal(await service.procesarSiguiente(), true);
  assert.deepEqual(eventos, [
    'referencias', 'eliminar', 'completar',
  ]);
});

test('Pendientes panorámicas: conserva un archivo referenciado', async () => {
  const { service, eventos } = preparar({ referenciado: true });

  await assert.rejects(service.procesarSiguiente(), {
    message:
      'El archivo pendiente continúa referenciado por una panorámica.',
  });

  assert.deepEqual(eventos, ['referencias']);
});

test('Pendientes panorámicas: no elimina si falla la consulta', async () => {
  const original = new Error('Falló PostgreSQL');
  const { service, eventos } = preparar({
    errorConsulta: original,
  });

  await assert.rejects(
    service.procesarSiguiente(),
    (error) => error === original,
  );

  assert.deepEqual(eventos, ['referencias']);
});