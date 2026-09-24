require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasMapaConsultaService,
} = require('../dist/modules/incidencias/incidencias-mapa-consulta.service');

const {
  ListarIncidenciasMapaQueryDto,
} = require('../dist/modules/incidencias/dto/listar-incidencias-mapa-query.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'query',
    metatype: ListarIncidenciasMapaQueryDto,
  });
}

test('listado mapa DTO: aplica valores predeterminados', async () => {
  const resultado = await validar({});

  assert.deepEqual({ ...resultado }, {
    pagina: 1,
    limite: 50,
  });
});

test('listado mapa DTO: convierte parámetros válidos', async () => {
  const resultado = await validar({ pagina: '2', limite: '100' });

  assert.deepEqual({ ...resultado }, {
    pagina: 2,
    limite: 100,
  });
});

test('listado mapa DTO: rechaza valores inválidos y campos de plano', async () => {
  for (const entrada of [
    { pagina: '0' },
    { pagina: '2147483648' },
    { pagina: '1.5' },
    { pagina: '1e2' },
    { pagina: '1\n' },
    { pagina: ['1', '2'] },
    { limite: '0' },
    { limite: '101' },
    { limite: '' },
    { limite: null },
    { numero_pagina: '1' },
    { id_plano: 'plano' },
  ]) {
    await assert.rejects(
      validar(entrada),
      (error) => error.getStatus() === 400,
    );
  }
});

test('listado mapa servicio: transmite parámetros y construye la respuesta pública', async () => {
  const fila = {
    id_incidencia: 'incidencia',
    id_proyecto: 'proyecto',
    id_creador: 'creador',
    titulo: 'Fisura',
    descripcion: 'Revisar.',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    latitud: '4.711',
    longitud: '-74.0721',
    fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
    dato_interno: 'NO_PUBLICAR',
  };

  const servicio = new IncidenciasMapaConsultaService({
    async listarDisponibles(...argumentos) {
      assert.deepEqual(argumentos, ['proyecto', 'usuario', 2, 20]);
      return { incidencias: [fila], total: 21 };
    },
  });

  const resultado = await servicio.listar(
    'proyecto',
    'usuario',
    { pagina: 2, limite: 20 },
  );

  assert.equal(resultado.pagina, 2);
  assert.equal(resultado.limite, 20);
  assert.equal(resultado.total, 21);
  assert.equal(resultado.total_paginas, 2);
  assert.equal(resultado.incidencias.length, 1);
  assert.equal(resultado.incidencias[0].latitud, 4.711);
  assert.equal(resultado.incidencias[0].longitud, -74.0721);
  assert.equal(
    Object.hasOwn(resultado.incidencias[0], 'dato_interno'),
    false,
  );
  assert.equal(fila.latitud, '4.711');
});

test('listado mapa servicio: distingue proyecto inaccesible de listado vacío', async () => {
  const servicio = new IncidenciasMapaConsultaService({
    async listarDisponibles() {
      return null;
    },
  });

  await assert.rejects(
    servicio.listar('proyecto', 'usuario', { pagina: 1, limite: 50 }),
    (error) => {
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, 'El proyecto no está disponible.');
      return true;
    },
  );
});

test('listado mapa servicio: conserva los totales de páginas vacías', async () => {
  for (const total of [0, 21]) {
    const servicio = new IncidenciasMapaConsultaService({
      async listarDisponibles() {
        return { incidencias: [], total };
      },
    });

    assert.deepEqual(
      await servicio.listar(
        'proyecto',
        'usuario',
        { pagina: 3, limite: 20 },
      ),
      {
        incidencias: [],
        pagina: 3,
        limite: 20,
        total,
        total_paginas: total === 0 ? 0 : 2,
      },
    );
  }
});

test('listado mapa servicio: propaga errores de PostgreSQL', async () => {
  const original = new Error('Fallo de consulta');

  const servicio = new IncidenciasMapaConsultaService({
    async listarDisponibles() {
      throw original;
    },
  });

  await assert.rejects(
    servicio.listar('proyecto', 'usuario', { pagina: 1, limite: 50 }),
    (error) => error === original,
  );
});