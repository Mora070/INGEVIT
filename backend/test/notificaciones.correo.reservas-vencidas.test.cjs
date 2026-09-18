require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificacionesCorreoRepository,
} = require(
  '../dist/modules/notificaciones/correos/notificaciones-correo.repository'
);

test('reservas vencidas: parametriza el límite y devuelve la cantidad cerrada', async () => {
  const repository = new NotificacionesCorreoRepository();
  let parametros;

  const client = {
    async query(sql, values) {
      parametros = values;
      return { rows: [], rowCount: 3 };
    },
  };

  assert.equal(
    await repository.cerrarReservasVencidas(client, 100),
    3,
  );

  assert.deepEqual(parametros, [100]);
});

test('reservas vencidas: admite que no haya reservas para cerrar', async () => {
  const repository = new NotificacionesCorreoRepository();

  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  assert.equal(
    await repository.cerrarReservasVencidas(client, 100),
    0,
  );
});

test('reservas vencidas: rechaza límites inválidos antes de consultar', async () => {
  const repository = new NotificacionesCorreoRepository();
  let consultas = 0;

  const client = {
    async query() {
      consultas += 1;
      return { rows: [], rowCount: 0 };
    },
  };

  for (const limite of [
    0, -1, 1001, 1.5, NaN, Infinity, undefined, '100',
  ]) {
    await assert.rejects(
      () => repository.cerrarReservasVencidas(client, limite),
      /límite de reservas vencidas/,
    );
  }

  assert.equal(consultas, 0);
});

test('reservas vencidas: rechaza cantidades de actualización inesperadas', async () => {
  const repository = new NotificacionesCorreoRepository();

  for (const rowCount of [null, undefined, -1, 1.5, 101]) {
    const client = {
      async query() {
        return { rows: [], rowCount };
      },
    };

    await assert.rejects(
      () => repository.cerrarReservasVencidas(client, 100),
      /cantidad inesperada/,
    );
  }
});

test('reservas vencidas: propaga errores de PostgreSQL sin reintentar', async () => {
  const repository = new NotificacionesCorreoRepository();
  const error = new Error('Fallo simulado de PostgreSQL');
  let consultas = 0;

  const client = {
    async query() {
      consultas += 1;
      throw error;
    },
  };

  await assert.rejects(
    () => repository.cerrarReservasVencidas(client, 100),
    (recibido) => recibido === error,
  );

  assert.equal(consultas, 1);
});