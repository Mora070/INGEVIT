const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  toProyectoResponse,
} = require('../dist/modules/proyectos/mappers/proyecto.mapper');

/**
 * Representa la proyección SQL que devolverá el repositorio.
 * No crea proyectos ni consulta PostgreSQL.
 */
function crearProyecto(cambios = {}) {
  return {
    id_proyecto: '10000000-0000-4000-8000-000000000001',
    id_propietario: '20000000-0000-4000-8000-000000000002',
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: '4.7110',
    longitud: '-74.0721',
    ...cambios,
  };
}

test('toProyectoResponse: selecciona los campos autorizados y convierte las coordenadas', () => {
  const resultado = toProyectoResponse(
    crearProyecto({
      campo_interno_adicional: 'NO_DEBE_DEVOLVERSE',
    }),
  );

  assert.deepEqual(resultado, {
    id_proyecto: '10000000-0000-4000-8000-000000000001',
    id_propietario: '20000000-0000-4000-8000-000000000002',
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: 4.711,
    longitud: -74.0721,
  });
});

test('toProyectoResponse: conserva una ubicación ausente', () => {
  const resultado = toProyectoResponse(
    crearProyecto({
      latitud: null,
      longitud: null,
    }),
  );

  assert.equal(resultado.latitud, null);
  assert.equal(resultado.longitud, null);
});

test('toProyectoResponse: conserva coordenadas iguales a cero', () => {
  const resultado = toProyectoResponse(
    crearProyecto({
      latitud: '0',
      longitud: '0',
    }),
  );

  assert.equal(resultado.latitud, 0);
  assert.equal(resultado.longitud, 0);
});

test('toProyectoResponse: acepta los límites geográficos permitidos', () => {
  for (const [latitud, longitud] of [
    ['-90', '-180'],
    ['90', '180'],
  ]) {
    const resultado = toProyectoResponse(
      crearProyecto({ latitud, longitud }),
    );

    assert.equal(resultado.latitud, Number(latitud));
    assert.equal(resultado.longitud, Number(longitud));
  }
});

test('toProyectoResponse: conserva las fechas de calendario sin transformarlas', () => {
  const resultado = toProyectoResponse(
    crearProyecto({
      fecha_inicio: '2026-01-01',
      fecha_finalizacion: '2026-12-31',
    }),
  );

  assert.equal(resultado.fecha_inicio, '2026-01-01');
  assert.equal(resultado.fecha_finalizacion, '2026-12-31');
});

test('toProyectoResponse: no confunde el estado de trabajo con la eliminación lógica', () => {
  const resultado = toProyectoResponse(
    crearProyecto({
      estado_proyecto: 'ACTIVA',
      activo: false,
    }),
  );

  assert.equal(resultado.estado_proyecto, 'ACTIVA');
  assert.equal(resultado.activo, false);
});

test('toProyectoResponse: rechaza una ubicación incompleta', () => {
  for (const ubicacion of [
    { latitud: null, longitud: '-74.0721' },
    { latitud: '4.7110', longitud: null },
  ]) {
    assert.throws(
      () => toProyectoResponse(crearProyecto(ubicacion)),
      {
        message: 'El proyecto contiene una ubicación incompleta.',
      },
    );
  }
});

test('toProyectoResponse: rechaza coordenadas vacías o de tipo inesperado', () => {
  for (const campo of ['latitud', 'longitud']) {
    for (const valor of ['', '   ', undefined, 4.5, true, {}]) {
      assert.throws(
        () =>
          toProyectoResponse(
            crearProyecto({ [campo]: valor }),
          ),
        {
          message:
            'El proyecto contiene una coordenada con formato inválido.',
        },
      );
    }
  }
});

test('toProyectoResponse: rechaza coordenadas no finitas o fuera de rango', () => {
  const ubicacionesInvalidas = [
    { latitud: '90.1' },
    { latitud: '-90.1' },
    { longitud: '180.1' },
    { longitud: '-180.1' },
    { latitud: 'NaN' },
    { longitud: 'Infinity' },
    { latitud: 'texto-invalido' },
  ];

  for (const ubicacion of ubicacionesInvalidas) {
    assert.throws(
      () => toProyectoResponse(crearProyecto(ubicacion)),
      {
        message:
          'El proyecto contiene una coordenada fuera del rango permitido.',
      },
    );
  }
});

test('toProyectoResponse: no modifica el proyecto recibido', () => {
  const proyecto = crearProyecto();
  const original = structuredClone(proyecto);

  const resultado = toProyectoResponse(proyecto);

  assert.deepEqual(proyecto, original);
  assert.notStrictEqual(resultado, proyecto);
});