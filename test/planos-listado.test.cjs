require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  PlanosService,
} = require('../dist/modules/planos/planos.service');

const {
  ListarPlanosQueryDto,
} = require('../dist/modules/planos/dto/listar-planos-query.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(entrada) {
  return createValidationPipe().transform(entrada, {
    type: 'query',
    metatype: ListarPlanosQueryDto,
  });
}

test('listado planos: utiliza paginación predeterminada', async () => {
  const resultado = await validar({});
  assert.equal(resultado.pagina, 1);
  assert.equal(resultado.limite, 20);
});

test('listado planos: transforma números recibidos como texto', async () => {
  const resultado = await validar({ pagina: '2', limite: '10' });
  assert.equal(resultado.pagina, 2);
  assert.equal(resultado.limite, 10);
});

test('listado planos: rechaza un límite excesivo', async () => {
  await assert.rejects(
    () => validar({ limite: '101' }),
    (error) => {
      assert.equal(error.getStatus(), 400);
      return true;
    },
  );
});

test('listado planos: conserva el total cuando la página está vacía', async () => {
  const servicio = new PlanosService({
    async findDisponiblesPaginadas(...argumentos) {
      assert.deepEqual(argumentos, ['proyecto', 'usuario', 3, 10]);
      return { planos: [], total: 15 };
    },
  });

  assert.deepEqual(
    await servicio.listarDisponibles(
      'proyecto',
      'usuario',
      { pagina: 3, limite: 10 },
    ),
    {
      planos: [],
      pagina: 3,
      limite: 10,
      total: 15,
      total_paginas: 2,
    },
  );
});

test('listado planos: rechaza un proyecto no disponible', async () => {
  const servicio = new PlanosService({
    async findDisponiblesPaginadas() {
      return null;
    },
  });

  await assert.rejects(
    () => servicio.listarDisponibles(
      'proyecto',
      'usuario',
      { pagina: 1, limite: 20 },
    ),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      return true;
    },
  );
});

test('listado planos: propaga errores del repositorio', async () => {
  const esperado = new Error('Fallo simulado');

  const servicio = new PlanosService({
    async findDisponiblesPaginadas() {
      throw esperado;
    },
  });

  await assert.rejects(
    () => servicio.listarDisponibles(
      'proyecto',
      'usuario',
      { pagina: 1, limite: 20 },
    ),
    (error) => {
      assert.strictEqual(error, esperado);
      return true;
    },
  );
});