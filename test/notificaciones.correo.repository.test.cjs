require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificacionesCorreoRepository,
} = require(
  '../dist/modules/notificaciones/correos/notificaciones-correo.repository'
);

const ID = '20000000-0000-4000-8000-000000000001';
const RESERVA = '30000000-0000-4000-8000-000000000001';

test('correo repository: devuelve la reserva y parametriza sus límites', async () => {
  const repository = new NotificacionesCorreoRepository();
  let parametros;
  let fila;

  const client = {
    async query(sql, values) {
      parametros = values;

      fila = {
        id_notificacion: ID,
        id_receptor: '40000000-0000-4000-8000-000000000001',
        id_proyecto: '50000000-0000-4000-8000-000000000001',
        tipo: 'INCIDENCIA_CREADA',
        titulo: 'Incidencia creada',
        mensaje: 'Fisura en el acceso.',
        correo_intentos: 1,
        correo_reserva: values[0],
        correo_reservado_hasta: new Date('2026-09-16T12:02:00Z'),
      };

      return { rows: [fila], rowCount: 1 };
    },
  };

  const resultado = await repository.reservarSiguiente(
    client,
    120,
    5,
  );

  assert.strictEqual(resultado, fila);
  assert.equal(parametros[1], 120);
  assert.equal(parametros[2], 5);

  assert.match(
    parametros[0],
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('correo repository: devuelve null cuando no hay candidatas', async () => {
  const repository = new NotificacionesCorreoRepository();

  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  assert.equal(
    await repository.reservarSiguiente(client, 120, 5),
    null,
  );
});

test('correo repository: valida los límites antes de consultar PostgreSQL', async () => {
  const repository = new NotificacionesCorreoRepository();
  let consultas = 0;

  const client = {
    async query() {
      consultas += 1;
      throw new Error('No debe consultar');
    },
  };

  for (const segundos of [0, 29, 3601, 30.5, NaN, Infinity]) {
    await assert.rejects(
      () => repository.reservarSiguiente(client, segundos, 5),
      /duración de la reserva/,
    );
  }

  for (const intentos of [0, 101, 1.5, NaN, Infinity]) {
    await assert.rejects(
      () => repository.reservarSiguiente(client, 120, intentos),
      /máximo de intentos/,
    );
  }

  assert.equal(consultas, 0);
});

test('correo repository: genera identificadores diferentes para cada reserva', async () => {
  const repository = new NotificacionesCorreoRepository();
  const reservas = [];

  const client = {
    async query(sql, values) {
      reservas.push(values[0]);
      return { rows: [], rowCount: 0 };
    },
  };

  await repository.reservarSiguiente(client, 120, 5);
  await repository.reservarSiguiente(client, 120, 5);

  assert.notEqual(reservas[0], reservas[1]);
});

test('correo repository: actualiza resultados utilizando el identificador de reserva', async () => {
  const repository = new NotificacionesCorreoRepository();

  for (const metodo of ['marcarEnviada', 'marcarFallida']) {
    let parametros;

    const client = {
      async query(sql, values) {
        parametros = values;
        return { rows: [], rowCount: 1 };
      },
    };

    assert.equal(
      await repository[metodo](client, ID, RESERVA),
      true,
    );

    assert.deepEqual(parametros, [ID, RESERVA]);
  }
});

test('correo repository: informa cuando la actualización no afectó ninguna fila', async () => {
  const repository = new NotificacionesCorreoRepository();

  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  assert.equal(
    await repository.marcarEnviada(client, ID, RESERVA),
    false,
  );

  assert.equal(
    await repository.marcarFallida(client, ID, RESERVA),
    false,
  );
});

test('correo repository: propaga errores de PostgreSQL sin reintentar', async () => {
  const repository = new NotificacionesCorreoRepository();
  const error = new Error('Fallo simulado de PostgreSQL');
  let consultas = 0;

  const client = {
    async query() {
      consultas += 1;
      throw error;
    },
  };

  const operaciones = [
    () => repository.reservarSiguiente(client, 120, 5),
    () => repository.marcarEnviada(client, ID, RESERVA),
    () => repository.marcarFallida(client, ID, RESERVA),
  ];

  for (const operacion of operaciones) {
    await assert.rejects(
      operacion,
      (recibido) => recibido === error,
    );
  }

  assert.equal(consultas, 3);
});