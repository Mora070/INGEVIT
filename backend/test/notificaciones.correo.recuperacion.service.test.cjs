require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificacionesCorreoService,
} = require(
  '../dist/modules/notificaciones/correos/notificaciones-correo.service'
);

test('correo recuperación: utiliza una transacción y limita el lote a 100', async () => {
  const client = {};
  const eventos = [];

  const database = {
    async withTransaction(operacion) {
      eventos.push('begin');
      const resultado = await operacion(client);
      eventos.push('commit');
      return resultado;
    },
  };

  const repository = {
    async cerrarReservasVencidas(recibido, limite) {
      assert.strictEqual(recibido, client);
      assert.equal(limite, 100);
      eventos.push('recuperar');
      return 3;
    },
  };

  const correo = {
    async enviar() {
      assert.fail('La recuperación no debe enviar correos');
    },
  };

  const servicio = new NotificacionesCorreoService(
    database,
    repository,
    correo,
  );

  assert.equal(await servicio.recuperarReservasVencidas(), 3);
  assert.deepEqual(eventos, ['begin', 'recuperar', 'commit']);
});

test('correo recuperación: propaga un fallo de confirmación sin reintentar', async () => {
  const error = new Error('Resultado de COMMIT desconocido');
  let recuperaciones = 0;

  const database = {
    async withTransaction(operacion) {
      await operacion({});
      throw error;
    },
  };

  const repository = {
    async cerrarReservasVencidas() {
      recuperaciones += 1;
      return 1;
    },
  };

  const servicio = new NotificacionesCorreoService(
    database,
    repository,
    {
      async enviar() {
        assert.fail('La recuperación no debe enviar correos');
      },
    },
  );

  await assert.rejects(
    () => servicio.recuperarReservasVencidas(),
    (recibido) => recibido === error,
  );

  assert.equal(recuperaciones, 1);
});