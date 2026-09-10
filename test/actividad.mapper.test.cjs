require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearActividad,
} = require('../dist/modules/actividades/mappers/actividad.mapper');

function crearActividad(cambios = {}) {
  return {
    id_actividad: '40000000-0000-4000-8000-000000000004',
    id_proyecto: '20000000-0000-4000-8000-000000000002',
    id_actor: '10000000-0000-4000-8000-000000000001',
    tipo_accion: 'PROYECTO_CREADO',
    mensaje: 'Proyecto creado.',
    fecha_creacion: new Date('2026-09-10T15:30:00.000Z'),
    ...cambios,
  };
}

test(
  'mapearActividad: devuelve únicamente los campos públicos',
  () => {
    const actividad = crearActividad({
      correo_actor: 'prueba@example.invalid',
      password_hash: 'HASH_FICTICIO_NO_PUBLICABLE',
      dato_interno: 'NO_PUBLICABLE',
    });

    assert.deepEqual(mapearActividad(actividad), {
      id_actividad: '40000000-0000-4000-8000-000000000004',
      id_proyecto: '20000000-0000-4000-8000-000000000002',
      id_actor: '10000000-0000-4000-8000-000000000001',
      tipo_accion: 'PROYECTO_CREADO',
      mensaje: 'Proyecto creado.',
      fecha_creacion: '2026-09-10T15:30:00.000Z',
    });
  },
);

test(
  'mapearActividad: convierte la fecha a UTC conservando el instante y los milisegundos',
  () => {
    const actividad = crearActividad({
      fecha_creacion: new Date('2026-09-10T10:30:00.123-05:00'),
    });

    const resultado = mapearActividad(actividad);

    assert.equal(
      resultado.fecha_creacion,
      '2026-09-10T15:30:00.123Z',
    );
  },
);

test(
  'mapearActividad: crea una respuesta nueva sin modificar el registro original',
  () => {
    const actividad = crearActividad();
    const copiaAnterior = {
      ...actividad,
      fecha_creacion: new Date(actividad.fecha_creacion.getTime()),
    };

    const resultado = mapearActividad(actividad);

    assert.notStrictEqual(resultado, actividad);
    assert.deepEqual(actividad, copiaAnterior);
    assert.ok(actividad.fecha_creacion instanceof Date);

    // Cambiar la respuesta no debe alterar el registro recibido.
    resultado.mensaje = 'Mensaje modificado en la respuesta';

    assert.deepEqual(actividad, copiaAnterior);
  },
);

test(
  'mapearActividad: rechaza una fecha inválida en lugar de producir una respuesta incorrecta',
  () => {
    const actividad = crearActividad({
      fecha_creacion: new Date(Number.NaN),
    });

    assert.throws(
      () => mapearActividad(actividad),
      RangeError,
    );
  },
);