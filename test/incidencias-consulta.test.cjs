require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ListarIncidenciasQueryDto,
} = require('../dist/modules/incidencias/dto/listar-incidencias-query.dto');

const {
  IncidenciasConsultaService,
} = require('../dist/modules/incidencias/incidencias-consulta.service');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

async function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'query',
    metatype: ListarIncidenciasQueryDto,
  });
}

test('ListarIncidenciasQueryDto: convierte la página del PDF y aplica valores predeterminados', async () => {
  const resultado = await validar({ numero_pagina: '2' });

  assert.ok(resultado instanceof ListarIncidenciasQueryDto);
  assert.deepEqual({ ...resultado }, {
    numero_pagina: 2,
    pagina: 1,
    limite: 50,
  });
});

test('ListarIncidenciasQueryDto: convierte la paginación explícita', async () => {
  const resultado = await validar({
    numero_pagina: '3',
    pagina: '2',
    limite: '25',
  });

  assert.deepEqual({ ...resultado }, {
    numero_pagina: 3,
    pagina: 2,
    limite: 25,
  });
});

const invalidos = [
  ['página del PDF ausente', {}],
  ['página del PDF cero', { numero_pagina: '0' }],
  ['página del PDF decimal', { numero_pagina: '1.5' }],
  ['salto de línea', { numero_pagina: '1\n' }],
  ['página de resultados cero', {
    numero_pagina: '1', pagina: '0',
  }],
  ['límite excesivo', {
    numero_pagina: '1', limite: '101',
  }],
  ['parámetro adicional', {
    numero_pagina: '1', id_creador: 'otro',
  }],
];

for (const [nombre, datos] of invalidos) {
  test(`ListarIncidenciasQueryDto: rechaza ${nombre}`, async () => {
    await assert.rejects(
      validar(datos),
      (error) => error.getStatus() === 400,
    );
  });
}

test('IncidenciasConsulta: conserva el conteo cuando la página de resultados está vacía', async () => {
  const service = new IncidenciasConsultaService({
    async listarDisponibles(...argumentos) {
      assert.deepEqual(argumentos, [
        'proyecto', 'plano', 'usuario', 2, 99, 10,
      ]);

      return {
        numeroPaginas: 3,
        total: 21,
        incidencias: [],
      };
    },
  });

  const resultado = await service.listar(
    'proyecto',
    'plano',
    'usuario',
    { numero_pagina: 2, pagina: 99, limite: 10 },
  );

  assert.deepEqual(resultado, {
    incidencias: [],
    numero_pagina: 2,
    pagina: 99,
    limite: 10,
    total: 21,
    total_paginas: 3,
  });
});

test('IncidenciasConsulta: rechaza un plano no disponible', async () => {
  const service = new IncidenciasConsultaService({
    async listarDisponibles() {
      return null;
    },
  });

  await assert.rejects(
    service.listar('proyecto', 'plano', 'usuario', {
      numero_pagina: 2,
      pagina: 1,
      limite: 50,
    }),
    (error) => {
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, 'El plano no está disponible.');
      return true;
    },
  );
});

test('IncidenciasConsulta: rechaza una página que supera el PDF', async () => {
  const service = new IncidenciasConsultaService({
    async listarDisponibles() {
      return {
        numeroPaginas: 2,
        total: 0,
        incidencias: [],
      };
    },
  });

  await assert.rejects(
    service.listar('proyecto', 'plano', 'usuario', {
      numero_pagina: 3,
      pagina: 1,
      limite: 50,
    }),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(error.message, 'La página indicada no existe en el plano.');
      return true;
    },
  );
});

test('IncidenciasConsulta: propaga el error del repositorio', async () => {
  const original = new Error('Falló PostgreSQL');

  const service = new IncidenciasConsultaService({
    async listarDisponibles() {
      throw original;
    },
  });

  await assert.rejects(
    service.listar('proyecto', 'plano', 'usuario', {
      numero_pagina: 1,
      pagina: 1,
      limite: 50,
    }),
    (error) => error === original,
  );
});