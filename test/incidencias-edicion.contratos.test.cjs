require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ActualizarIncidenciaDto,
} = require('../dist/modules/incidencias/dto/actualizar-incidencia.dto');

const {
  IncidenciasRepository,
} = require('../dist/modules/incidencias/incidencias.repository');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const DATOS = {
  titulo: 'Fisura revisada',
  descripcion: 'Revisión en curso.',
  prioridad: 'ALTA',
  estado: 'EN_PROCESO',
};

function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'body',
    metatype: ActualizarIncidenciaDto,
  });
}

test('ActualizarIncidenciaDto: admite los estados existentes', async () => {
  for (const estado of ['PENDIENTE', 'EN_PROCESO', 'SOLUCIONADA']) {
    const datos = { ...DATOS, estado };
    const resultado = await validar(datos);

    assert.ok(resultado instanceof ActualizarIncidenciaDto);
    assert.deepEqual({ ...resultado }, datos);
  }
});

test('ActualizarIncidenciaDto: rechaza campos inválidos o ausentes', async () => {
  for (const cambios of [
    { titulo: '' },
    { descripcion: null },
    { prioridad: 'URGENTE' },
    { estado: 'CERRADA' },
    { estado: undefined },
  ]) {
    await assert.rejects(
      validar({ ...DATOS, ...cambios }),
      (error) => error.getStatus() === 400,
    );
  }
});

test('ActualizarIncidenciaDto: rechaza cambios de autoría o ubicación', async () => {
  for (const extra of [
    { id_creador: 'otro-usuario' },
    { id_plano: 'otro-plano' },
    { numero_pagina: 2 },
    { coordenada_x: 10 },
    { coordenada_y: 20 },
  ]) {
    await assert.rejects(
      validar({ ...DATOS, ...extra }),
      (error) => error.getStatus() === 400,
    );
  }
});

test('IncidenciasRepository.actualizarDatos: parametriza y limita los campos modificados', async () => {
  const repository = new IncidenciasRepository();
  const datos = { ...DATOS, titulo: "Texto'; SELECT 1; --" };
  const fila = { id_incidencia: 'incidencia', ...datos };

  const resultado = await repository.actualizarDatos(
    {
      async query(sql, valores) {
        assert.deepEqual(valores, [
          'proyecto', 'plano', 'incidencia',
          datos.titulo, datos.descripcion, datos.prioridad, datos.estado,
        ]);

        assert.equal(sql.includes(datos.titulo), false);
        assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
        assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);
        assert.match(sql, /AND\s+id_incidencia\s*=\s*\$3/i);

        const asignaciones = sql.match(/\bSET\b([\s\S]*?)\bWHERE\b/i);
        assert.ok(asignaciones);
        assert.equal(
          asignaciones[1].replace(/\s+/g, ' ').trim(),
          'titulo = $4, descripcion = $5, prioridad = $6, estado = $7',
        );

        return { rowCount: 1, rows: [fila] };
      },
    },
    'proyecto',
    'plano',
    'incidencia',
    datos,
  );

  assert.strictEqual(resultado, fila);
});

test('IncidenciasRepository.actualizarDatos: devuelve null cuando no encuentra la incidencia', async () => {
  const repository = new IncidenciasRepository();

  assert.equal(
    await repository.actualizarDatos(
      {
        async query() {
          return { rowCount: 0, rows: [] };
        },
      },
      'proyecto', 'plano', 'incidencia', DATOS,
    ),
    null,
  );
});

test('IncidenciasRepository.actualizarDatos: propaga errores y rechaza resultados inconsistentes', async () => {
  const repository = new IncidenciasRepository();
  const original = new Error('Falló PostgreSQL');

  await assert.rejects(
    repository.actualizarDatos(
      {
        async query() {
          throw original;
        },
      },
      'proyecto', 'plano', 'incidencia', DATOS,
    ),
    (error) => error === original,
  );

  for (const resultado of [
    { rowCount: 1, rows: [] },
    { rowCount: null, rows: [] },
    { rowCount: 0, rows: [{}] },
    { rowCount: 2, rows: [{}, {}] },
  ]) {
    await assert.rejects(
      repository.actualizarDatos(
        {
          async query() {
            return resultado;
          },
        },
        'proyecto', 'plano', 'incidencia', DATOS,
      ),
      {
        message:
          'La actualización de la incidencia devolvió un resultado inesperado.',
      },
    );
  }
});