require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasEdicionService,
} = require('../dist/modules/fotografias/fotografias-edicion.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';
const ID_ACTOR = '10000000-0000-4000-8000-000000000001';
const ID_AUTOR = '40000000-0000-4000-8000-000000000004';

const DATOS = { titulo: 'Avance actualizado' };

/**
 * Sustituye las dependencias para comprobar la coordinación.
 * La reversión real se comprobará después con PostgreSQL.
 */
function preparar(opciones = {}) {
  const client = {};
  const operaciones = [];

  const fotografia = {
    id_fotografia: ID_FOTOGRAFIA,
    id_proyecto: ID_PROYECTO,
    id_usuario_subida: ID_AUTOR,
    titulo: DATOS.titulo,
    url: '/fotografia.webp',
    s3_key: 'fotografias/50000000-0000-4000-8000-000000000005.webp',
    original_s3_key:
      'fotografias/60000000-0000-4000-8000-000000000006.jpeg',
    fecha_subida: new Date('2026-09-14T12:00:00.000Z'),
  };

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
    async actualizarTitulo(cliente, idProyecto, idFotografia, titulo) {
      operaciones.push('actualizar');

      assert.strictEqual(cliente, client);
      assert.equal(idProyecto, ID_PROYECTO);
      assert.equal(idFotografia, ID_FOTOGRAFIA);
      assert.equal(titulo, DATOS.titulo);

      if (opciones.errorActualizacion) {
        throw opciones.errorActualizacion;
      }

      return opciones.fotografiaAusente ? null : fotografia;
    },
  };

  const actividades = {
    async crear(cliente, datos) {
      operaciones.push('actividad');

      assert.strictEqual(cliente, client);
      assert.deepEqual(datos, {
        idProyecto: ID_PROYECTO,
        idActor: ID_ACTOR,
        tipoAccion: 'FOTOGRAFIA_TITULO_GUARDADO',
        mensaje: `Título de la fotografía ${ID_FOTOGRAFIA} guardado.`,
      });

      if (opciones.errorActividad) {
        throw opciones.errorActividad;
      }
    },
  };

  const servicio = new FotografiasEdicionService(
    database,
    acceso,
    fotografias,
    actividades,
  );

  return {
    operaciones,
    ejecutar: () =>
      servicio.actualizarTitulo(
        ID_PROYECTO,
        ID_FOTOGRAFIA,
        ID_ACTOR,
        DATOS,
      ),
  };
}

test(
  'edición fotografía: autoriza, actualiza y registra la actividad antes de confirmar',
  async () => {
    const { ejecutar, operaciones } = preparar();

    const resultado = await ejecutar();

    assert.deepEqual(operaciones, [
      'iniciar',
      'autorizar',
      'actualizar',
      'actividad',
      'confirmar',
    ]);

    assert.equal(resultado.id_fotografia, ID_FOTOGRAFIA);
    assert.equal(resultado.titulo, DATOS.titulo);

    // El actor de la edición no reemplaza al autor de la fotografía.
    assert.equal(resultado.id_usuario_subida, ID_AUTOR);

    assert.equal(
      resultado.fecha_subida,
      '2026-09-14T12:00:00.000Z',
    );

    assert.equal(Object.hasOwn(resultado, 's3_key'), false);
    assert.equal(Object.hasOwn(resultado, 'original_s3_key'), false);
  },
);

test(
  'edición fotografía: rechaza un proyecto no disponible antes de actualizar',
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
  'edición fotografía: no registra actividad si la fotografía no existe en el proyecto',
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
      'actualizar',
    ]);
  },
);

const casosDeError = [
  [
    'errorAcceso',
    'un fallo al comprobar el acceso',
    ['iniciar', 'autorizar'],
  ],
  [
    'errorActualizacion',
    'un fallo al actualizar',
    ['iniciar', 'autorizar', 'actualizar'],
  ],
  [
    'errorActividad',
    'un fallo al registrar la actividad',
    ['iniciar', 'autorizar', 'actualizar', 'actividad'],
  ],
];

for (const [opcion, descripcion, pasosEsperados] of casosDeError) {
  test(
    `edición fotografía: propaga ${descripcion} sin confirmar`,
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