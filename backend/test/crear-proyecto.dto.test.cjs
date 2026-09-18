require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  CrearProyectoDto,
} = require('../dist/modules/proyectos/dto/crear-proyecto.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Datos ficticios de entrada.
 * Estas pruebas no crean proyectos en PostgreSQL.
 */
function crearEntrada(cambios = {}) {
  return {
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    estado_proyecto: 'ACTIVA',
    ...cambios,
  };
}

async function validarProyecto(body) {
  return createValidationPipe().transform(body, {
    type: 'body',
    metatype: CrearProyectoDto,
    data: undefined,
  });
}

function comprobarEntradaRechazada(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('CrearProyectoDto: acepta los campos obligatorios sin ubicación ni fecha final', async () => {
  const resultado = await validarProyecto(crearEntrada());

  assert.ok(resultado instanceof CrearProyectoDto);
  assert.equal(resultado.nombre, 'Proyecto de prueba');
  assert.equal(resultado.fecha_inicio, '2026-09-09');
  assert.equal(resultado.fecha_finalizacion, undefined);
  assert.equal(resultado.latitud, undefined);
  assert.equal(resultado.longitud, undefined);
});

test('CrearProyectoDto: admite valores opcionales nulos', async () => {
  const resultado = await validarProyecto(
    crearEntrada({
      fecha_finalizacion: null,
      latitud: null,
      longitud: null,
    }),
  );

  assert.equal(resultado.fecha_finalizacion, null);
  assert.equal(resultado.latitud, null);
  assert.equal(resultado.longitud, null);
});

test('CrearProyectoDto: acepta los tres estados de trabajo', async () => {
  for (const estado_proyecto of ['ACTIVA', 'PAUSA', 'FINALIZADA']) {
    const resultado = await validarProyecto(
      crearEntrada({ estado_proyecto }),
    );

    assert.equal(resultado.estado_proyecto, estado_proyecto);
  }
});

test('CrearProyectoDto: rechaza estados ausentes o no definidos', async () => {
  for (const estado_proyecto of [
    undefined,
    null,
    '',
    'ACTIVO',
    'INACTIVO',
    'activa',
  ]) {
    await assert.rejects(
      () => validarProyecto(crearEntrada({ estado_proyecto })),
      comprobarEntradaRechazada,
    );
  }
});

test('CrearProyectoDto: rechaza textos obligatorios ausentes, vacíos o de tipo incorrecto', async () => {
  const campos = ['nombre', 'descripcion', 'direccion', 'contratante'];

  for (const campo of campos) {
    for (const valor of [undefined, null, '', 123, true, {}, []]) {
      await assert.rejects(
        () =>
          validarProyecto(
            crearEntrada({ [campo]: valor }),
          ),
        comprobarEntradaRechazada,
      );
    }
  }
});

test('CrearProyectoDto: acepta fechas de calendario válidas', async () => {
  const resultado = await validarProyecto(
    crearEntrada({
      fecha_inicio: '2024-02-29',
      fecha_finalizacion: '2026-12-31',
    }),
  );

  assert.equal(resultado.fecha_inicio, '2024-02-29');
  assert.equal(resultado.fecha_finalizacion, '2026-12-31');
});

test('CrearProyectoDto: rechaza fechas imposibles o con hora', async () => {
  const fechasInvalidas = [
    '',
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '09/09/2026',
    '2026-09-09T10:30:00Z',
    20260909,
  ];

  for (const campo of ['fecha_inicio', 'fecha_finalizacion']) {
    for (const valor of fechasInvalidas) {
      await assert.rejects(
        () =>
          validarProyecto(
            crearEntrada({ [campo]: valor }),
          ),
        comprobarEntradaRechazada,
      );
    }
  }
});

test('CrearProyectoDto: exige la fecha de inicio', async () => {
  for (const fecha_inicio of [undefined, null]) {
    await assert.rejects(
      () => validarProyecto(crearEntrada({ fecha_inicio })),
      comprobarEntradaRechazada,
    );
  }
});

test('CrearProyectoDto: admite coordenadas numéricas y sus límites', async () => {
  for (const [latitud, longitud] of [
    [4.711, -74.0721],
    [0, 0],
    [-90, -180],
    [90, 180],
  ]) {
    const resultado = await validarProyecto(
      crearEntrada({ latitud, longitud }),
    );

    assert.equal(resultado.latitud, latitud);
    assert.equal(resultado.longitud, longitud);
  }
});

test('CrearProyectoDto: rechaza una ubicación incompleta', async () => {
  const ubicacionesIncompletas = [
    { latitud: 4.711 },
    { longitud: -74.0721 },
    { latitud: 4.711, longitud: null },
    { latitud: null, longitud: -74.0721 },
    { latitud: 0 },
    { longitud: 0 },
  ];

  for (const ubicacion of ubicacionesIncompletas) {
    await assert.rejects(
      () => validarProyecto(crearEntrada(ubicacion)),
      comprobarEntradaRechazada,
    );
  }
});

test('CrearProyectoDto: rechaza coordenadas fuera de rango o que no son números finitos', async () => {
  const ubicacionesInvalidas = [
    { latitud: 90.1, longitud: 0 },
    { latitud: -90.1, longitud: 0 },
    { latitud: 0, longitud: 180.1 },
    { latitud: 0, longitud: -180.1 },
    { latitud: '4.711', longitud: '-74.0721' },
    { latitud: true, longitud: 0 },
    { latitud: {}, longitud: 0 },
    { latitud: [4.711], longitud: 0 },
    { latitud: NaN, longitud: 0 },
    { latitud: 0, longitud: Infinity },
  ];

  for (const ubicacion of ubicacionesInvalidas) {
    await assert.rejects(
      () => validarProyecto(crearEntrada(ubicacion)),
      comprobarEntradaRechazada,
    );
  }
});

test('CrearProyectoDto: rechaza campos administrados por el backend', async () => {
  const camposNoPermitidos = [
    ['id_proyecto', '10000000-0000-4000-8000-000000000001'],
    ['id_propietario', '20000000-0000-4000-8000-000000000002'],
    ['activo', false],
    ['rol', 'ADMINISTRADOR'],
  ];

  for (const [campo, valor] of camposNoPermitidos) {
    await assert.rejects(
      () =>
        validarProyecto(
          crearEntrada({ [campo]: valor }),
        ),
      comprobarEntradaRechazada,
    );
  }
});

test('CrearProyectoDto: no modifica los datos recibidos', async () => {
  const entrada = crearEntrada({
    latitud: 4.711,
    longitud: -74.0721,
  });

  const original = structuredClone(entrada);

  await validarProyecto(entrada);

  assert.deepEqual(entrada, original);
});