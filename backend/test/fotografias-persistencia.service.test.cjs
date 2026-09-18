require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasPersistenciaService,
} = require(
  '../dist/modules/fotografias/fotografias-persistencia.service',
);

const {
  ResultadoTransaccionDesconocidoError,
} = require(
  '../dist/database/errors/resultado-transaccion-desconocido.error',
);

const CLAVES = {
  original_s3_key:
    'fotografias/60000000-0000-4000-8000-000000000006.jpeg',
  s3_key:
    'fotografias/50000000-0000-4000-8000-000000000005.webp',
};

function crearFotografiaProcesada() {
  return {
    original: Buffer.from('Original de prueba.'),
    formatoOriginal: 'jpeg',
    optimizada: Buffer.from('Optimizada de prueba.'),
  };
}

/**
 * Simula archivos y transacción para probar la coordinación.
 *
 * errorTransaccion representa un fallo posterior al callback,
 * por ejemplo una confirmación incierta.
 *
 * No ejecuta SQL ni escribe archivos.
 */
function crearEscenario({
  errorArchivos,
  errorTransaccion,
  errorLimpieza,
} = {}) {
  const operaciones = [];
  const client = {};
  const fotografia = crearFotografiaProcesada();

  const archivos = {
    async guardarVersiones(recibida) {
      assert.strictEqual(recibida, fotografia);
      operaciones.push('guardar');

      if (errorArchivos) {
        throw errorArchivos;
      }

      return CLAVES;
    },

    async eliminarVersiones(claves) {
      assert.strictEqual(claves, CLAVES);
      operaciones.push('eliminar');

      if (errorLimpieza) {
        throw errorLimpieza;
      }
    },
  };

  const database = {
    async withTransaction(operacion) {
      operaciones.push('transaccion');

      const resultado = await operacion(client);

      if (errorTransaccion) {
        throw errorTransaccion;
      }

      operaciones.push('confirmacion');
      return resultado;
    },
  };

  return {
    servicio: new FotografiasPersistenciaService(database, archivos),
    fotografia,
    client,
    operaciones,
  };
}

test(
  'guardarYRegistrar: entrega las claves y el cliente al registro y devuelve el resultado confirmado',
  async () => {
    const {
      servicio,
      fotografia,
      client,
      operaciones,
    } = crearEscenario();

    const esperado = { id_fotografia: 'identificador-de-prueba' };

    const resultado = await servicio.guardarYRegistrar(
      fotografia,
      async (clienteRecibido, claves) => {
        operaciones.push('registrar');

        assert.strictEqual(clienteRecibido, client);
        assert.strictEqual(claves, CLAVES);

        return esperado;
      },
    );

    assert.strictEqual(resultado, esperado);
    assert.deepEqual(operaciones, [
      'guardar',
      'transaccion',
      'registrar',
      'confirmacion',
    ]);
  },
);

test(
  'guardarYRegistrar: no inicia una transacción ni duplica la limpieza si falla el guardado',
  async () => {
    const errorEsperado = new Error('Fallo al guardar las versiones.');

    const { servicio, fotografia, operaciones } = crearEscenario({
      errorArchivos: errorEsperado,
    });

    await assert.rejects(
      servicio.guardarYRegistrar(fotografia, async () => {
        assert.fail('El registro no debe ejecutarse.');
      }),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(operaciones, ['guardar']);
  },
);

test(
  'guardarYRegistrar: compensa los archivos cuando el registro falla con reversión confirmada',
  async () => {
    const errorEsperado = new Error('Fallo del registro.');

    const { servicio, fotografia, operaciones } = crearEscenario();

    await assert.rejects(
      servicio.guardarYRegistrar(fotografia, async () => {
        operaciones.push('registrar');
        throw errorEsperado;
      }),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(operaciones, [
      'guardar',
      'transaccion',
      'registrar',
      'eliminar',
    ]);
  },
);

for (const etapa of ['COMMIT', 'ROLLBACK']) {
  test(
    `guardarYRegistrar: conserva los archivos cuando el resultado de ${etapa} es incierto`,
    async () => {
      const causa = new Error('Fallo de transacción simulado.');

      const errorIncierto = new ResultadoTransaccionDesconocidoError(
        etapa,
        causa,
        etapa === 'ROLLBACK'
          ? new Error('No se confirmó la reversión.')
          : undefined,
      );

      const { servicio, fotografia, operaciones } = crearEscenario({
        errorTransaccion: errorIncierto,
      });

      await assert.rejects(
        servicio.guardarYRegistrar(fotografia, async () => {
          operaciones.push('registrar');
          return {};
        }),
        (error) => error === errorIncierto,
      );

      assert.deepEqual(operaciones, [
        'guardar',
        'transaccion',
        'registrar',
      ]);
    },
  );
}

test(
  'guardarYRegistrar: conserva el error de registro y el de compensación',
  async () => {
    const errorRegistro = new Error('Fallo del registro.');
    const errorLimpieza = new Error('Fallo de limpieza.');

    const { servicio, fotografia, operaciones } = crearEscenario({
      errorLimpieza,
    });

    await assert.rejects(
      servicio.guardarYRegistrar(fotografia, async () => {
        operaciones.push('registrar');
        throw errorRegistro;
      }),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(
          error.message,
          'Falló el registro de la fotografía y no pudieron eliminarse todas sus versiones.',
        );
        assert.equal(error.errors.length, 2);
        assert.strictEqual(error.errors[0], errorRegistro);
        assert.strictEqual(error.errors[1], errorLimpieza);

        return true;
      },
    );

    assert.deepEqual(operaciones, [
      'guardar',
      'transaccion',
      'registrar',
      'eliminar',
    ]);
  },
);