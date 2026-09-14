require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasEliminacionService,
} = require('../dist/modules/fotografias/fotografias-eliminacion.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';
const ID_ACTOR = '10000000-0000-4000-8000-000000000001';

const CLAVE_ORIGINAL =
  'fotografias/40000000-0000-4000-8000-000000000004.jpeg';

const CLAVE_OPTIMIZADA =
  'fotografias/50000000-0000-4000-8000-000000000005.webp';

/**
 * Comprueba la coordinación del servicio con dependencias sustituidas.
 * La reversión real se verificará en las pruebas de integración.
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

  const acceso = {
    async bloquearDisponible(cliente, idProyecto, idUsuario) {
      operaciones.push('autorizar');

      assert.strictEqual(cliente, client);
      assert.equal(idProyecto, ID_PROYECTO);
      assert.equal(idUsuario, ID_ACTOR);

      if (opciones.errorAcceso) {
        throw opciones.errorAcceso;
      }

      return opciones.disponible ?? true;
    },
  };

  const fotografias = {
    async eliminar(cliente, idProyecto, idFotografia) {
      operaciones.push('eliminar');

      assert.strictEqual(cliente, client);
      assert.equal(idProyecto, ID_PROYECTO);
      assert.equal(idFotografia, ID_FOTOGRAFIA);

      if (opciones.errorEliminacion) {
        throw opciones.errorEliminacion;
      }

      if (opciones.fotografiaAusente) {
        return null;
      }

      return {
        id_fotografia: ID_FOTOGRAFIA,
        original_s3_key: CLAVE_ORIGINAL,
        s3_key: CLAVE_OPTIMIZADA,
      };
    },
  };

  const pendientes = {
    async registrar(cliente, claves) {
      operaciones.push('encolar');

      assert.strictEqual(cliente, client);
      assert.deepEqual(claves, [
        CLAVE_ORIGINAL,
        CLAVE_OPTIMIZADA,
      ]);

      if (opciones.errorCola) {
        throw opciones.errorCola;
      }
    },
  };

  const actividades = {
    async crear(cliente, datos) {
      operaciones.push('actividad');

      assert.strictEqual(cliente, client);
      assert.deepEqual(datos, {
        idProyecto: ID_PROYECTO,
        idActor: ID_ACTOR,
        tipoAccion: 'FOTOGRAFIA_ELIMINADA',
        mensaje: `Fotografía ${ID_FOTOGRAFIA} eliminada.`,
      });

      if (opciones.errorActividad) {
        throw opciones.errorActividad;
      }
    },
  };

  const servicio = new FotografiasEliminacionService(
    database,
    acceso,
    fotografias,
    pendientes,
    actividades,
  );

  return {
    operaciones,
    ejecutar: () =>
      servicio.eliminar(
        ID_PROYECTO,
        ID_FOTOGRAFIA,
        ID_ACTOR,
      ),
  };
}

test(
  'eliminación fotografía: elimina, encola ambas versiones y registra actividad antes de confirmar',
  async () => {
    const { ejecutar, operaciones } = preparar();

    const resultado = await ejecutar();

    assert.equal(resultado, undefined);
    assert.deepEqual(operaciones, [
      'iniciar',
      'autorizar',
      'eliminar',
      'encolar',
      'actividad',
      'confirmar',
    ]);
  },
);

test(
  'eliminación fotografía: rechaza un proyecto no disponible sin eliminar',
  async () => {
    const { ejecutar, operaciones } = preparar({
      disponible: false,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, 'El proyecto no está disponible.');
      return true;
    });

    assert.deepEqual(operaciones, ['iniciar', 'autorizar']);
  },
);

test(
  'eliminación fotografía: una fotografía ausente no genera tareas ni actividad',
  async () => {
    const { ejecutar, operaciones } = preparar({
      fotografiaAusente: true,
    });

    await assert.rejects(ejecutar, (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, 'La fotografía no está disponible.');
      return true;
    });

    assert.deepEqual(operaciones, [
      'iniciar',
      'autorizar',
      'eliminar',
    ]);
  },
);

const casosDeError = [
  [
    'errorAcceso',
    'autorización',
    ['iniciar', 'autorizar'],
  ],
  [
    'errorEliminacion',
    'eliminación del registro',
    ['iniciar', 'autorizar', 'eliminar'],
  ],
  [
    'errorCola',
    'registro de pendientes',
    ['iniciar', 'autorizar', 'eliminar', 'encolar'],
  ],
  [
    'errorActividad',
    'registro de actividad',
    ['iniciar', 'autorizar', 'eliminar', 'encolar', 'actividad'],
  ],
];

for (const [opcion, descripcion, pasosEsperados] of casosDeError) {
  test(
    `eliminación fotografía: propaga el fallo de ${descripcion} sin confirmar`,
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