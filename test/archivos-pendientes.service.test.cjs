require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesService,
} = require('../dist/modules/almacenamiento/archivos-pendientes.service');

const CLAVE =
  'fotografias/10000000-0000-4000-8000-000000000001.webp';

/**
 * Comprueba la coordinación sin borrar archivos ni consultar PostgreSQL.
 * Las transacciones y el almacenamiento reales se prueban por separado.
 */
function preparar(opciones = {}) {
  const client = {};
  const operaciones = [];

  const database = {
    async withTransaction(operacion) {
      operaciones.push('iniciar');

      const resultado = await operacion(client);

      operaciones.push('confirmar');
      return resultado;
    },
  };

  const pendientes = {
    async bloquearSiguiente(cliente) {
      operaciones.push('bloquear');
      assert.strictEqual(cliente, client);

      if (opciones.sinTareas) {
        return null;
      }

      return {
        s3_key: opciones.clave ?? CLAVE,
        fecha_creacion: new Date('2026-09-14T12:00:00.000Z'),
      };
    },

    async estaReferenciadoEnFotografias(cliente, clave) {
      operaciones.push('comprobar-referencias');

      assert.strictEqual(cliente, client);
      assert.equal(clave, CLAVE);

      if (opciones.errorReferencias) {
        throw opciones.errorReferencias;
      }

      return opciones.referenciado ?? false;
    },

    async completar(cliente, clave) {
      operaciones.push('completar');

      assert.strictEqual(cliente, client);
      assert.equal(clave, CLAVE);

      if (opciones.errorCompletar) {
        throw opciones.errorCompletar;
      }
    },
  };

  const almacenamiento = {
    async eliminar(clave) {
      operaciones.push('eliminar-archivo');
      assert.equal(clave, CLAVE);

      if (opciones.errorAlmacenamiento) {
        throw opciones.errorAlmacenamiento;
      }
    },
  };

  const servicio = new ArchivosPendientesService(
    database,
    pendientes,
    almacenamiento,
  );

  return {
    operaciones,
    ejecutar: () => servicio.procesarSiguiente(),
  };
}

test(
  'procesarSiguiente: comprueba referencias y elimina antes de completar la tarea',
  async () => {
    const { ejecutar, operaciones } = preparar();

    assert.equal(await ejecutar(), true);

    assert.deepEqual(operaciones, [
      'iniciar',
      'bloquear',
      'comprobar-referencias',
      'eliminar-archivo',
      'completar',
      'confirmar',
    ]);
  },
);

test(
  'procesarSiguiente: devuelve false sin acceder al almacenamiento cuando no hay tareas',
  async () => {
    const { ejecutar, operaciones } = preparar({
      sinTareas: true,
    });

    assert.equal(await ejecutar(), false);

    assert.deepEqual(operaciones, [
      'iniciar',
      'bloquear',
      'confirmar',
    ]);
  },
);

test(
  'procesarSiguiente: conserva un archivo que continúa referenciado',
  async () => {
    const { ejecutar, operaciones } = preparar({
      referenciado: true,
    });

    await assert.rejects(ejecutar, {
      message:
        'El archivo pendiente continúa referenciado por una fotografía.',
    });

    assert.deepEqual(operaciones, [
      'iniciar',
      'bloquear',
      'comprobar-referencias',
    ]);
  },
);

test(
  'procesarSiguiente: rechaza una categoría todavía no implementada',
  async () => {
    const { ejecutar, operaciones } = preparar({
      clave: 'panoramicas/20000000-0000-4000-8000-000000000002.jpg',
    });

    await assert.rejects(ejecutar, {
      message:
        'La categoría del archivo pendiente todavía no puede procesarse.',
    });

    assert.deepEqual(operaciones, ['iniciar', 'bloquear']);
  },
);

test(
  'procesarSiguiente: rechaza una clave inválida antes de comprobar referencias',
  async () => {
    const { ejecutar, operaciones } = preparar({
      clave: '../archivo.webp',
    });

    await assert.rejects(ejecutar, {
      message:
        'La clave de almacenamiento tiene un formato no permitido.',
    });

    assert.deepEqual(operaciones, ['iniciar', 'bloquear']);
  },
);

const casosDeError = [
  [
    'errorReferencias',
    'la consulta de referencias',
    ['iniciar', 'bloquear', 'comprobar-referencias'],
  ],
  [
    'errorAlmacenamiento',
    'el borrado del archivo',
    [
      'iniciar',
      'bloquear',
      'comprobar-referencias',
      'eliminar-archivo',
    ],
  ],
  [
    'errorCompletar',
    'la retirada de la tarea',
    [
      'iniciar',
      'bloquear',
      'comprobar-referencias',
      'eliminar-archivo',
      'completar',
    ],
  ],
];

for (const [opcion, descripcion, pasosEsperados] of casosDeError) {
  test(
    `procesarSiguiente: propaga el fallo de ${descripcion} sin confirmar`,
    async () => {
      const errorEsperado = new Error('Fallo simulado');

      const { ejecutar, operaciones } = preparar({
        [opcion]: errorEsperado,
      });

      await assert.rejects(ejecutar, (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      });

      assert.deepEqual(operaciones, pasosEsperados);
    },
  );
}