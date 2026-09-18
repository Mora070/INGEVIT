require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasArchivosService,
} = require(
  '../dist/modules/fotografias/fotografias-archivos.service',
);

function crearFotografiaProcesada() {
  return {
    original: Buffer.from('Bytes originales de prueba.'),
    formatoOriginal: 'jpeg',
    optimizada: Buffer.from('Bytes optimizados de prueba.'),
  };
}

/**
 * Simula el almacenamiento y registra el orden de las operaciones.
 *
 * Los buffers no son imágenes reales: este servicio solo debe
 * transferir los bytes recibidos, sin interpretarlos ni modificarlos.
 */
function crearEscenario({
  falloEnEscritura,
  errorEscritura = new Error('Fallo de escritura simulado.'),
  errorLimpieza,
} = {}) {
  const operaciones = [];
  const flujos = [];
  let numeroEscritura = 0;

  const almacenamiento = {
    async guardar(clave, entrada) {
      numeroEscritura += 1;
      flujos.push(entrada);

      const operacion = {
        tipo: 'guardar',
        clave,
      };

      operaciones.push(operacion);

      // Simula un fallo antes de consumir el flujo.
      if (numeroEscritura === falloEnEscritura) {
        throw errorEscritura;
      }

      const fragmentos = [];

      for await (const fragmento of entrada) {
        fragmentos.push(Buffer.from(fragmento));
      }

      operacion.contenido = Buffer.concat(fragmentos);
    },

    async eliminar(clave) {
      operaciones.push({
        tipo: 'eliminar',
        clave,
      });

      if (errorLimpieza) {
        throw errorLimpieza;
      }
    },
  };

  return {
    servicio: new FotografiasArchivosService(almacenamiento),
    operaciones,
    flujos,
  };
}

test(
  'guardarVersiones: guarda original y optimizada con claves distintas y conserva sus bytes',
  async () => {
    const fotografia = crearFotografiaProcesada();
    const copiaOriginal = Buffer.from(fotografia.original);
    const copiaOptimizada = Buffer.from(fotografia.optimizada);

    const { servicio, operaciones, flujos } = crearEscenario();

    const claves = await servicio.guardarVersiones(fotografia);

    assert.notEqual(claves.original_s3_key, claves.s3_key);
    assert.match(claves.original_s3_key, /\.jpeg$/);
    assert.match(claves.s3_key, /\.webp$/);

    assert.deepEqual(operaciones, [
      {
        tipo: 'guardar',
        clave: claves.original_s3_key,
        contenido: copiaOriginal,
      },
      {
        tipo: 'guardar',
        clave: claves.s3_key,
        contenido: copiaOptimizada,
      },
    ]);

    assert.deepEqual(fotografia.original, copiaOriginal);
    assert.deepEqual(fotografia.optimizada, copiaOptimizada);
    assert.equal(flujos.every((flujo) => flujo.destroyed), true);
  },
);

test(
  'guardarVersiones: no elimina claves ni intenta la segunda escritura si falla la primera',
  async () => {
    const errorEsperado = new Error('La clave original ya existe.');

    const { servicio, operaciones, flujos } = crearEscenario({
      falloEnEscritura: 1,
      errorEscritura: errorEsperado,
    });

    await assert.rejects(
      servicio.guardarVersiones(crearFotografiaProcesada()),
      (error) => error === errorEsperado,
    );

    assert.equal(operaciones.length, 1);
    assert.equal(operaciones[0].tipo, 'guardar');
    assert.equal(flujos.length, 1);
    assert.equal(flujos[0].destroyed, true);
  },
);

test(
  'guardarVersiones: elimina únicamente el original guardado cuando falla la optimizada',
  async () => {
    const errorEsperado = new Error('Falló la versión optimizada.');

    const { servicio, operaciones, flujos } = crearEscenario({
      falloEnEscritura: 2,
      errorEscritura: errorEsperado,
    });

    await assert.rejects(
      servicio.guardarVersiones(crearFotografiaProcesada()),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['guardar', 'guardar', 'eliminar'],
    );

    assert.equal(
      operaciones[2].clave,
      operaciones[0].clave,
    );

    // No debe eliminar una clave cuya escritura no confirmó éxito.
    assert.notEqual(
      operaciones[2].clave,
      operaciones[1].clave,
    );

    assert.equal(flujos.length, 2);
    assert.equal(flujos.every((flujo) => flujo.destroyed), true);
  },
);

test(
  'guardarVersiones: conserva ambos errores cuando también falla la compensación',
  async () => {
    const errorEscritura = new Error('Falló la versión optimizada.');
    const errorLimpieza = new Error('No pudo eliminarse el original.');

    const { servicio, operaciones, flujos } = crearEscenario({
      falloEnEscritura: 2,
      errorEscritura,
      errorLimpieza,
    });

    await assert.rejects(
      servicio.guardarVersiones(crearFotografiaProcesada()),
      (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(
          error.message,
          'Falló el guardado de la versión optimizada y no pudo eliminarse el original.',
        );

        assert.strictEqual(error.errors[0], errorEscritura);
        assert.strictEqual(error.errors[1], errorLimpieza);
        assert.equal(error.errors.length, 2);

        return true;
      },
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['guardar', 'guardar', 'eliminar'],
    );

    assert.equal(
      operaciones[2].clave,
      operaciones[0].clave,
    );
    assert.equal(flujos.every((flujo) => flujo.destroyed), true);
  },
);