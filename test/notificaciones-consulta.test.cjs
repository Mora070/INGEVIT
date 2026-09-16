require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ListarNotificacionesQueryDto,
} = require('../dist/modules/notificaciones/dto/listar-notificaciones-query.dto');

const {
  NotificacionesConsultaService,
} = require('../dist/modules/notificaciones/notificaciones-consulta.service');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(datos) {
  return createValidationPipe().transform(datos, {
    type: 'query',
    metatype: ListarNotificacionesQueryDto,
  });
}

test('NotificacionesQuery: aplica valores predeterminados y convierte enteros', async () => {
  assert.deepEqual({ ...await validar({}) }, {
    pagina: 1,
    limite: 20,
  });

  assert.deepEqual({
    ...await validar({ pagina: '2', limite: '10' }),
  }, {
    pagina: 2,
    limite: 10,
  });
});

test('NotificacionesQuery: rechaza parámetros inválidos y receptores externos', async () => {
  for (const datos of [
    { pagina: '0' },
    { pagina: '1.5' },
    { pagina: '1\n' },
    { limite: '101' },
    { id_receptor: 'otro-usuario' },
  ]) {
    await assert.rejects(
      validar(datos),
      (error) => error.getStatus() === 400,
    );
  }
});

test('NotificacionesConsulta: conserva el total en una página sin resultados', async () => {
  const service = new NotificacionesConsultaService({
    async listarDisponibles(...argumentos) {
      assert.deepEqual(argumentos, ['usuario', 99, 10]);
      return { notificaciones: [], total: 21 };
    },
  });

  assert.deepEqual(
    await service.listar('usuario', { pagina: 99, limite: 10 }),
    {
      notificaciones: [],
      pagina: 99,
      limite: 10,
      total: 21,
      total_paginas: 3,
    },
  );
});

test('NotificacionesConsulta: propaga los errores del repositorio', async () => {
  const original = new Error('Falló PostgreSQL');

  const service = new NotificacionesConsultaService({
    async listarDisponibles() {
      throw original;
    },
  });

  await assert.rejects(
    service.listar('usuario', { pagina: 1, limite: 20 }),
    (error) => error === original,
  );
});