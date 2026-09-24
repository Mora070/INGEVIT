require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearCapa,
} = require('../dist/modules/capas/mappers/capa.mapper');

const {
  CapasConsultaRepository,
} = require('../dist/modules/capas/capas-consulta.repository');

function crearFila(cambios = {}) {
  return {
    id_capa: 'capa',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'usuario',
    nombre: 'Ortofoto',
    descripcion: '',
    nombre_archivo_original: 'levantamiento.tif',
    almacenamiento_proveedor: 'LOCAL',
    original_key: 'capas/clave-interna.tif',
    tamano_original_bytes: '9007199254740993',
    crs_original: 'EPSG:32618',
    bbox_oeste: '-74.1',
    bbox_sur: '4.6',
    bbox_este: '-74.0',
    bbox_norte: '4.7',
    estado_procesamiento: 'LISTA',
    mapbox_source_id: 'fuente',
    mapbox_tileset_id: 'cuenta.tileset',
    mapbox_job_id: 'trabajo',
    error_procesamiento: null,
    opacidad: '0.65',
    visible: false,
    orden: 2,
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
    fecha_actualizacion: new Date('2026-09-22T13:00:00.000Z'),
    teselas_version: '50000000-0000-4000-8000-000000000005',
    teselas_proveedor: 'LOCAL',
    teselas_zoom_min: 12,
    teselas_zoom_max: 18,
    teselas_tamano: 256,
    teselas_total: '277',
    ...cambios,
  };
}

test('mapearCapa: selecciona campos públicos y conserva la precisión del tamaño', () => {
  const fila = crearFila();
  const copia = { ...fila };

  assert.deepEqual(mapearCapa(fila), {
    id_capa: 'capa',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'usuario',
    nombre: 'Ortofoto',
    descripcion: '',
    nombre_archivo_original: 'levantamiento.tif',
    tamano_original_bytes: '9007199254740993',
    crs_original: 'EPSG:32618',
    bbox: [-74.1, 4.6, -74, 4.7],
    estado_procesamiento: 'LISTA',
    teselas: {
      version: '50000000-0000-4000-8000-000000000005',
      zoom_min: 12,
      zoom_max: 18,
      tamano: 256,
      total: '277',
    },
    opacidad: 0.65,
    visible: false,
    orden: 2,
    fecha_creacion: '2026-09-22T12:00:00.000Z',
    fecha_actualizacion: '2026-09-22T13:00:00.000Z',
  });

  assert.deepEqual(fila, copia);
});

test('mapearCapa: oculta las teselas mientras la capa no esté lista', () => {
  for (const estado of ['PENDIENTE', 'PROCESANDO', 'ERROR']) {
    const resultado = mapearCapa(crearFila({
      estado_procesamiento: estado,
      error_procesamiento: 'Detalle interno que no debe publicarse',
    }));

    assert.equal(resultado.teselas, null);
    assert.equal(Object.hasOwn(resultado, 'mapbox_tileset_id'), false);
    assert.equal(Object.hasOwn(resultado, 'error_procesamiento'), false);
  }
});

test('mapearCapa: admite metadatos pendientes y opacidad cero', () => {
  const resultado = mapearCapa(crearFila({
    estado_procesamiento: 'PENDIENTE',
    crs_original: null,
    bbox_oeste: null,
    bbox_sur: null,
    bbox_este: null,
    bbox_norte: null,
    opacidad: '0',
    orden: 0,
  }));

  assert.equal(resultado.bbox, null);
  assert.equal(resultado.opacidad, 0);
  assert.equal(resultado.orden, 0);
});

test('mapearCapa: rechaza extensiones incompletas o inválidas', () => {
  for (const cambios of [
    { bbox_oeste: null },
    { bbox_sur: undefined },
    { bbox_norte: '91' },
    { bbox_oeste: '-73' },
    { bbox_sur: '4.7' },
    { bbox_este: 'NaN' },
  ]) {
    assert.throws(() => mapearCapa(crearFila(cambios)), /capa/);
  }
});

test('mapearCapa: rechaza capas listas sin metadatos y estados desconocidos', () => {
  for (const cambios of [
    { teselas_version: null },
    { crs_original: '' },
    { estado_procesamiento: 'DESCONOCIDO' },
  ]) {
    assert.throws(() => mapearCapa(crearFila(cambios)), /capa/);
  }
});

test('mapearCapa: rechaza tamaño y configuración inválidos', () => {
  for (const cambios of [
    { tamano_original_bytes: '0' },
    { tamano_original_bytes: '1.5' },
    { tamano_original_bytes: '9223372036854775808' },
    { opacidad: '' },
    { opacidad: 'Infinity' },
    { opacidad: '1.1' },
    { visible: 'false' },
    { orden: -1 },
    { orden: 0.5 },
  ]) {
    assert.throws(() => mapearCapa(crearFila(cambios)), /capa/);
  }
});

test('consulta de capas: parametriza la página y separa el total', async () => {
  const fila = crearFila();
  let llamadas = 0;

  const repositorio = new CapasConsultaRepository({
    async query(sql, valores) {
      llamadas += 1;
      assert.deepEqual(valores, ['proyecto', 'usuario', 20, 40]);
      return { rows: [{ ...fila, total: '45' }] };
    },
  });

  assert.deepEqual(
    await repositorio.listarDisponibles('proyecto', 'usuario', 3, 20),
    { capas: [fila], total: 45 },
  );
  assert.equal(llamadas, 1);
});

test('consulta de capas: distingue falta de acceso y página vacía', async () => {
  for (const [filas, esperado] of [
    [[], null],
    [[{ id_capa: null, total: '0' }], { capas: [], total: 0 }],
    [[{ id_capa: null, total: '45' }], { capas: [], total: 45 }],
  ]) {
    const repositorio = new CapasConsultaRepository({
      async query() {
        return { rows: filas };
      },
    });

    assert.deepEqual(
      await repositorio.listarDisponibles('proyecto', 'usuario', 1, 20),
      esperado,
    );
  }
});

test('consulta de capas: rechaza conteos inválidos', async () => {
  for (const total of ['', '1\n', '-1', '1.5', '9007199254740992', null]) {
    const repositorio = new CapasConsultaRepository({
      async query() {
        return { rows: [{ id_capa: null, total }] };
      },
    });

    await assert.rejects(
      repositorio.listarDisponibles('proyecto', 'usuario', 1, 20),
      /conteo de capas/,
    );
  }
});

test('consulta de capas: propaga errores de PostgreSQL', async () => {
  const original = new Error('Fallo SQL');
  const repositorio = new CapasConsultaRepository({
    async query() {
      throw original;
    },
  });

  await assert.rejects(
    repositorio.listarDisponibles('proyecto', 'usuario', 1, 20),
    (error) => error === original,
  );
});

test('mapearCapa: admite publicación propia sin identificadores de Mapbox', () => {
  const resultado = mapearCapa(crearFila({
    mapbox_source_id: null,
    mapbox_tileset_id: null,
    mapbox_job_id: null,
    teselas_total: '9007199254740993',
  }));

  assert.equal(resultado.teselas.total, '9007199254740993');
  assert.equal(Object.hasOwn(resultado, 'mapbox_tileset_id'), false);
  assert.equal(Object.hasOwn(resultado, 'teselas_proveedor'), false);
});

test('mapearCapa: rechaza metadatos de teselas incompletos o inválidos', () => {
  for (const cambios of [
    { teselas_version: '../otra-carpeta' },
    { teselas_proveedor: null },
    { teselas_proveedor: 'OTRO' },
    { teselas_zoom_min: -1 },
    { teselas_zoom_min: '12' },
    { teselas_zoom_max: 11 },
    { teselas_zoom_max: 18.5 },
    { teselas_tamano: 512 },
    { teselas_total: null },
    { teselas_total: '0' },
    { teselas_total: '1.5' },
    { teselas_total: '277\n' },
    { teselas_total: '9223372036854775808' },
  ]) {
    assert.throws(
      () => mapearCapa(crearFila(cambios)),
      /metadatos de teselas/,
    );
  }
});