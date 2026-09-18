require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PanoramicasPersistenciaService,
} = require('../dist/modules/panoramicas/panoramicas-persistencia.service');

const {
  ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

test('PanoramicasPersistencia: conserva bytes y genera la extensión según el formato inspeccionado', async () => {
  for (const formato of ['jpeg', 'png', 'webp']) {
    const contenido = Buffer.from('bytes previamente inspeccionados');
    const client = {};
    const eventos = [];
    let claveGuardada;
    let flujo;

    const service = new PanoramicasPersistenciaService(
      {
        async withTransaction(operacion) {
          eventos.push('transaccion');
          const resultado = await operacion(client);
          eventos.push('confirmacion');
          return resultado;
        },
      },
      {
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
      },
    );

    const resultado = await service.guardarYRegistrar(
      contenido,
      formato,
      async (conexion, clave) => {
        assert.strictEqual(conexion, client);
        assert.equal(clave, claveGuardada);
        eventos.push('registro');
        return { registrado: true };
      },
    );

    assert.match(
      claveGuardada,
      /^panoramicas\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpeg|png|webp)$/,
    );
    assert.ok(claveGuardada.endsWith(`.${formato}`));
    assert.equal(flujo.destroyed, true);
    assert.deepEqual(resultado, { registrado: true });
    assert.deepEqual(eventos, [
      'archivo', 'transaccion', 'registro', 'confirmacion',
    ]);
  }
});

test('PanoramicasPersistencia: rechaza formatos internos inesperados antes de escribir', async () => {
  const service = new PanoramicasPersistenciaService(
    {
      async withTransaction() {
        assert.fail('No debe iniciar una transacción.');
      },
    },
    {
      async guardar() {
        assert.fail('No debe escribir el archivo.');
      },
    },
  );

  await assert.rejects(
    service.guardarYRegistrar(
      Buffer.from('imagen'),
      '../png',
      async () => {},
    ),
    {
      message: 'El formato interno de la panorámica no es válido.',
    },
  );
});

test('PanoramicasPersistencia: un fallo de escritura no inicia el registro ni elimina la clave', async () => {
  const original = new Error('Escritura rechazada');
  let flujo;

  const service = new PanoramicasPersistenciaService(
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
    service.guardarYRegistrar(
      Buffer.from('imagen'), 'png', async () => {},
    ),
    (error) => error === original,
  );

  assert.equal(flujo.destroyed, true);
});

test('PanoramicasPersistencia: elimina el archivo ante una reversión confirmada', async () => {
  const original = new Error('Registro rechazado');
  let claveGuardada;
  const eliminadas = [];

  const service = new PanoramicasPersistenciaService(
    {
      async withTransaction(operacion) {
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
    service.guardarYRegistrar(
      Buffer.from('imagen'),
      'jpeg',
      async () => { throw original; },
    ),
    (error) => error === original,
  );

  assert.deepEqual(eliminadas, [claveGuardada]);
});

test('PanoramicasPersistencia: conserva el archivo si el resultado transaccional es incierto', async () => {
  for (const etapa of ['COMMIT', 'ROLLBACK']) {
    const original = new ResultadoTransaccionDesconocidoError(
      etapa,
      new Error('Conexión interrumpida'),
    );

    const service = new PanoramicasPersistenciaService(
      {
        async withTransaction() {
          throw original;
        },
      },
      {
        async guardar() {},

        async eliminar() {
          assert.fail('No debe eliminar ante un resultado incierto.');
        },
      },
    );

    await assert.rejects(
      service.guardarYRegistrar(
        Buffer.from('imagen'), 'webp', async () => {},
      ),
      (error) => error === original,
    );
  }
});

test('PanoramicasPersistencia: conserva ambos errores cuando falla la limpieza', async () => {
  const errorRegistro = new Error('Falló el registro');
  const errorLimpieza = new Error('Falló la limpieza');

  const service = new PanoramicasPersistenciaService(
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
    service.guardarYRegistrar(
      Buffer.from('imagen'), 'png', async () => {},
    ),
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