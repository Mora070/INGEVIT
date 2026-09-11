require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasArchivosService,
} = require(
  '../dist/modules/fotografias/fotografias-archivos.service',
);

const CLAVES = {
  original_s3_key:
    'fotografias/60000000-0000-4000-8000-000000000006.jpeg',
  s3_key:
    'fotografias/50000000-0000-4000-8000-000000000005.webp',
};

/**
 * Simula únicamente la eliminación.
 *
 * No accede al disco. La ausencia de errores representa tanto
 * una eliminación correcta como un archivo que ya no existe.
 */
function crearEscenario({
  errorOriginal,
  errorOptimizada,
} = {}) {
  const eliminaciones = [];

  const almacenamiento = {
    async eliminar(clave) {
      eliminaciones.push(clave);

      if (clave === CLAVES.original_s3_key && errorOriginal) {
        throw errorOriginal;
      }

      if (clave === CLAVES.s3_key && errorOptimizada) {
        throw errorOptimizada;
      }
    },
  };

  return {
    servicio: new FotografiasArchivosService(almacenamiento),
    eliminaciones,
  };
}

function comprobarAmbasClaves(eliminaciones) {
  // No dependemos del orden de ejecución de operaciones independientes.
  assert.deepEqual(
    [...eliminaciones].sort(),
    [CLAVES.original_s3_key, CLAVES.s3_key].sort(),
  );
}

test(
  'eliminarVersiones: elimina ambas referencias y termina sin resultado',
  async () => {
    const { servicio, eliminaciones } = crearEscenario();

    const resultado = await servicio.eliminarVersiones(CLAVES);

    assert.equal(resultado, undefined);
    comprobarAmbasClaves(eliminaciones);
  },
);

test(
  'eliminarVersiones: intenta eliminar la optimizada aunque falle el original',
  async () => {
    const errorOriginal = new Error('No pudo eliminarse el original.');

    const { servicio, eliminaciones } = crearEscenario({
      errorOriginal,
    });

    await assert.rejects(
      servicio.eliminarVersiones(CLAVES),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(
          error.message,
          'No se pudieron eliminar todas las versiones de la fotografía.',
        );
        assert.equal(error.errors.length, 1);
        assert.strictEqual(error.errors[0], errorOriginal);

        return true;
      },
    );

    comprobarAmbasClaves(eliminaciones);
  },
);

test(
  'eliminarVersiones: conserva el error de la versión optimizada',
  async () => {
    const errorOptimizada = new Error(
      'No pudo eliminarse la versión optimizada.',
    );

    const { servicio, eliminaciones } = crearEscenario({
      errorOptimizada,
    });

    await assert.rejects(
      servicio.eliminarVersiones(CLAVES),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 1);
        assert.strictEqual(error.errors[0], errorOptimizada);

        return true;
      },
    );

    comprobarAmbasClaves(eliminaciones);
  },
);

test(
  'eliminarVersiones: conserva ambos errores cuando fallan las dos eliminaciones',
  async () => {
    const errorOriginal = new Error('Fallo del original.');
    const errorOptimizada = new Error('Fallo de la optimizada.');

    const { servicio, eliminaciones } = crearEscenario({
      errorOriginal,
      errorOptimizada,
    });

    await assert.rejects(
      servicio.eliminarVersiones(CLAVES),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors.length, 2);
        assert.strictEqual(error.errors[0], errorOriginal);
        assert.strictEqual(error.errors[1], errorOptimizada);

        return true;
      },
    );

    comprobarAmbasClaves(eliminaciones);
  },
);

test(
  'eliminarVersiones: espera a que terminen ambas eliminaciones antes de rechazar',
  async () => {
    const errorOriginal = new Error('Fallo del original.');

    let liberarOptimizada;
    let marcarInicioOptimizada;
    let finalizo = false;

    const optimizadaPendiente = new Promise((resolve) => {
      liberarOptimizada = resolve;
    });

    const optimizadaIniciada = new Promise((resolve) => {
      marcarInicioOptimizada = resolve;
    });

    const almacenamiento = {
      async eliminar(clave) {
        if (clave === CLAVES.original_s3_key) {
          throw errorOriginal;
        }

        assert.equal(clave, CLAVES.s3_key);
        marcarInicioOptimizada();

        await optimizadaPendiente;
      },
    };

    const servicio = new FotografiasArchivosService(almacenamiento);

    // Observamos el resultado sin dejar un rechazo sin manejar.
    const operacion = servicio.eliminarVersiones(CLAVES).then(
      () => {
        finalizo = true;
        return { correcto: true };
      },
      (error) => {
        finalizo = true;
        return { correcto: false, error };
      },
    );

    try {
      await optimizadaIniciada;

      // Permite procesar las promesas ya resueltas, sin una espera temporal.
      await Promise.resolve();
      await Promise.resolve();

      assert.equal(finalizo, false);

      liberarOptimizada();

      const resultado = await operacion;

      assert.equal(resultado.correcto, false);
      assert.ok(resultado.error instanceof AggregateError);
      assert.strictEqual(resultado.error.errors[0], errorOriginal);
    } finally {
      liberarOptimizada();
      await operacion;
    }
  },
);