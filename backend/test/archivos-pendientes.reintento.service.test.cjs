require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesService,
} = require('../dist/modules/almacenamiento/archivos-pendientes.service');

const CLAVE =
  'fotografias/10000000-0000-4000-8000-000000000001.webp';

/**
 * Comprueba la coordinación del procesamiento y del aplazamiento.
 * No ejecuta PostgreSQL ni elimina archivos reales.
 */
function preparar(opciones = {}) {
  const clientes = [];
  const aplazamientos = [];
  const operaciones = [];

  const database = {
    async withTransaction(operacion) {
      const client = { numero: clientes.length + 1 };
      clientes.push(client);
      operaciones.push(`iniciar-${client.numero}`);

      try {
        const resultado = await operacion(client);
        operaciones.push(`confirmar-${client.numero}`);
        return resultado;
      } catch (error) {
        operaciones.push(`fallar-${client.numero}`);
        throw error;
      }
    },
  };

  const pendientes = {
    async bloquearSiguiente(client) {
      assert.strictEqual(client, clientes[0]);

      if (opciones.errorSeleccion) {
        throw opciones.errorSeleccion;
      }

      if (opciones.sinTareas) {
        return null;
      }

      return {
        s3_key: CLAVE,
        fecha_creacion: new Date('2026-09-14T12:00:00.000Z'),
      };
    },

    async estaReferenciadoEnFotografias(client, clave) {
      assert.strictEqual(client, clientes[0]);
      assert.equal(clave, CLAVE);
      return false;
    },

    async completar(client, clave) {
      assert.strictEqual(client, clientes[0]);
      assert.equal(clave, CLAVE);
    },

    async aplazar(client, clave, demora) {
      // La primera operación debe haber terminado antes de entrar aquí.
      assert.ok(operaciones.includes('fallar-1'));
      assert.strictEqual(client, clientes[1]);
      assert.notStrictEqual(client, clientes[0]);

      aplazamientos.push({ clave, demora });

      if (opciones.errorAplazamiento) {
        throw opciones.errorAplazamiento;
      }

      return opciones.tareaDesaparecida ? false : true;
    },
  };

  const almacenamiento = {
    async eliminar() {
      if (opciones.errorProcesamiento) {
        throw opciones.errorProcesamiento;
      }
    },
  };

  const servicio = new ArchivosPendientesService(
    database,
    pendientes,
    almacenamiento,
  );

  return {
    clientes,
    aplazamientos,
    operaciones,
    ejecutar: (demora = 60) =>
      servicio.procesarSiguienteConReintento(demora),
  };
}

test(
  'reintento: procesa correctamente sin abrir una transacción de aplazamiento',
  async () => {
    const { ejecutar, clientes, aplazamientos } = preparar();

    assert.equal(await ejecutar(), true);
    assert.equal(clientes.length, 1);
    assert.deepEqual(aplazamientos, []);
  },
);

test(
  'reintento: devuelve false sin aplazar cuando no hay tareas',
  async () => {
    const { ejecutar, clientes, aplazamientos } = preparar({
      sinTareas: true,
    });

    assert.equal(await ejecutar(), false);
    assert.equal(clientes.length, 1);
    assert.deepEqual(aplazamientos, []);
  },
);

test(
  'reintento: aplaza en otra transacción y conserva el error original',
  async () => {
    const errorEsperado = new Error('Fallo del almacenamiento');

    const { ejecutar, aplazamientos, operaciones } = preparar({
      errorProcesamiento: errorEsperado,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.strictEqual(error, errorEsperado);
      return true;
    });

    assert.deepEqual(aplazamientos, [
      { clave: CLAVE, demora: 60 },
    ]);

    assert.deepEqual(operaciones, [
      'iniciar-1',
      'fallar-1',
      'iniciar-2',
      'confirmar-2',
    ]);
  },
);

test(
  'reintento: conserva ambos errores cuando también falla el aplazamiento',
  async () => {
    const errorProcesamiento = new Error('Fallo del almacenamiento');
    const errorAplazamiento = new Error('Fallo de PostgreSQL');

    const { ejecutar } = preparar({
      errorProcesamiento,
      errorAplazamiento,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(
        error.message,
        'Falló el procesamiento del archivo y no pudo confirmarse su aplazamiento.',
      );
      assert.equal(error.errors.length, 2);
      assert.strictEqual(error.errors[0], errorProcesamiento);
      assert.strictEqual(error.errors[1], errorAplazamiento);
      return true;
    });
  },
);

test(
  'reintento: no intenta aplazar cuando falla la selección de la tarea',
  async () => {
    const errorEsperado = new Error('Fallo de selección');

    const { ejecutar, clientes, aplazamientos } = preparar({
      errorSeleccion: errorEsperado,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.strictEqual(error, errorEsperado);
      return true;
    });

    assert.equal(clientes.length, 1);
    assert.deepEqual(aplazamientos, []);
  },
);

test(
  'reintento: conserva el error original si la tarea ya desapareció al aplazar',
  async () => {
    const errorEsperado = new Error('Fallo de procesamiento');

    const { ejecutar, aplazamientos } = preparar({
      errorProcesamiento: errorEsperado,
      tareaDesaparecida: true,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.strictEqual(error, errorEsperado);
      return true;
    });

    assert.deepEqual(aplazamientos, [
      { clave: CLAVE, demora: 60 },
    ]);
  },
);

test(
  'reintento: rechaza una demora inválida antes de iniciar una transacción',
  async () => {
    const { ejecutar, clientes } = preparar();

    await assert.rejects(
      () => ejecutar(0),
      {
        message:
          'La demora del reintento debe ser un número entero positivo de segundos.',
      },
    );

    assert.equal(clientes.length, 0);
  },
);