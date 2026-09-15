require('reflect-metadata');

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  PlanosPersistenciaService,
} = require('../dist/modules/planos/planos-persistencia.service');

const {
  ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

test('PlanosPersistencia: guarda los bytes originales antes de registrar', async () => {
  const contenido = Buffer.from('contenido previamente validado');
  const client = {};
  const esperado = { id_plano: 'plano-creado' };
  const eventos = [];

  let claveGuardada;
  let flujo;

  const almacenamiento = {
    async guardar(clave, entrada) {
      claveGuardada = clave;
      flujo = entrada;

      const partes = [];

      for await (const parte of entrada) {
        partes.push(Buffer.from(parte));
      }

      assert.deepEqual(Buffer.concat(partes), contenido);
      eventos.push('archivo');
    },

    async eliminar() {
      assert.fail('No debe eliminar un archivo registrado.');
    },
  };

  const database = {
    async withTransaction(operacion) {
      eventos.push('transaccion');
      const resultado = await operacion(client);
      eventos.push('confirmacion');
      return resultado;
    },
  };

  const service = new PlanosPersistenciaService(
    database,
    almacenamiento,
  );

  const resultado = await service.guardarYRegistrar(
    contenido,
    async (conexion, clave) => {
      assert.strictEqual(conexion, client);
      assert.equal(clave, claveGuardada);
      eventos.push('registro');
      return esperado;
    },
  );

  assert.strictEqual(resultado, esperado);
  assert.match(
    claveGuardada,
    /^planos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/,
  );
  assert.equal(flujo.destroyed, true);
  assert.deepEqual(eventos, [
    'archivo',
    'transaccion',
    'registro',
    'confirmacion',
  ]);
});

test('PlanosPersistencia: un fallo de escritura no inicia la transacción ni elimina la clave', async () => {
  const original = new Error('Escritura rechazada');
  let flujo;

  const service = new PlanosPersistenciaService(
    {
      async withTransaction() {
        assert.fail('No debe iniciar la transacción.');
      },
    },
    {
      async guardar(_clave, entrada) {
        flujo = entrada;
        throw original;
      },

      async eliminar() {
        assert.fail('No debe eliminar una clave cuya escritura falló.');
      },
    },
  );

  await assert.rejects(
    service.guardarYRegistrar(Buffer.from('pdf'), async () => {}),
    (error) => error === original,
  );

  assert.equal(flujo.destroyed, true);
});

test('PlanosPersistencia: elimina el archivo cuando el registro se revierte', async () => {
  const original = new Error('Registro rechazado');
  let claveGuardada;
  const eliminadas = [];

  const service = new PlanosPersistenciaService(
    {
      async withTransaction(operacion) {
        // Simula la propagación después de una reversión confirmada.
        return operacion({});
      },
    },
    {
      async guardar(clave) {
        claveGuardada = clave;
      },

      async eliminar(clave) {
        eliminadas.push(clave);
      },
    },
  );

  await assert.rejects(
    service.guardarYRegistrar(Buffer.from('pdf'), async () => {
      throw original;
    }),
    (error) => error === original,
  );

  assert.deepEqual(eliminadas, [claveGuardada]);
});

test('PlanosPersistencia: conserva el archivo ante COMMIT o ROLLBACK inciertos', async () => {
  for (const etapa of ['COMMIT', 'ROLLBACK']) {
    const original = new ResultadoTransaccionDesconocidoError(
      etapa,
      new Error('Conexión interrumpida'),
    );

    const service = new PlanosPersistenciaService(
      {
        async withTransaction() {
          throw original;
        },
      },
      {
        async guardar() {},

        async eliminar() {
          assert.fail(`No debe eliminar ante ${etapa} incierto.`);
        },
      },
    );

    await assert.rejects(
      service.guardarYRegistrar(Buffer.from('pdf'), async () => {}),
      (error) => error === original,
    );
  }
});

test('PlanosPersistencia: conserva ambos errores cuando falla la compensación', async () => {
  const errorRegistro = new Error('Registro rechazado');
  const errorLimpieza = new Error('Disco no disponible');

  const service = new PlanosPersistenciaService(
    {
      async withTransaction() {
        throw errorRegistro;
      },
    },
    {
      async guardar() {},

      async eliminar() {
        throw errorLimpieza;
      },
    },
  );

  await assert.rejects(
    service.guardarYRegistrar(Buffer.from('pdf'), async () => {}),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [
        errorRegistro,
        errorLimpieza,
      ]);
      return true;
    },
  );
});