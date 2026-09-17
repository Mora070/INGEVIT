require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');

const {
  RecuperacionColaWorker,
} = require('../dist/modules/auth/recuperacion-cola.worker');

const esperarTurno = () =>
  new Promise((resolve) => setImmediate(resolve));

function preparar(t, {
  habilitado = 'true',
  tareas = [],
  procesar = async () => {},
} = {}) {
  const temporizadores = [];
  const operaciones = [];
  const errores = [];

  t.mock.method(global, 'setTimeout', (callback, demora) => {
    assert.equal(demora, 2000);

    const temporizador = {
      callback,
      cancelado: false,
      unref() {},
    };

    temporizadores.push(temporizador);
    return temporizador;
  });

  t.mock.method(global, 'clearTimeout', (temporizador) => {
    temporizador.cancelado = true;
  });

  t.mock.method(Logger.prototype, 'error', (mensaje) => {
    errores.push(mensaje);
  });

  const pendientes = [...tareas];

  const cola = {
    async limpiarVencidas() {
      operaciones.push('limpiar');
      return 0;
    },
    async reservar() {
      operaciones.push('reservar');
      return pendientes.shift() ?? null;
    },
    async completar(id) {
      operaciones.push(`completar:${id}`);
    },
  };

  const recuperacion = {
    async solicitar(correo) {
      operaciones.push(`procesar:${correo}`);
      await procesar(correo);
    },
  };

  const worker = new RecuperacionColaWorker(cola, recuperacion);
  const anterior = process.env.RECUPERACION_TRABAJADOR_HABILITADO;

  try {
    process.env.RECUPERACION_TRABAJADOR_HABILITADO = habilitado;
    worker.onApplicationBootstrap();
  } finally {
    if (anterior === undefined) {
      delete process.env.RECUPERACION_TRABAJADOR_HABILITADO;
    } else {
      process.env.RECUPERACION_TRABAJADOR_HABILITADO = anterior;
    }
  }

  t.after(() => worker.beforeApplicationShutdown());

  return {
    worker,
    temporizadores,
    operaciones,
    errores,
    async ejecutarTemporizador(indice = 0) {
      const temporizador = temporizadores[indice];
      assert.ok(temporizador);
      assert.equal(temporizador.cancelado, false);
      temporizador.callback();
      await esperarTurno();
    },
  };
}

test('recuperación worker: deshabilitado no programa ni procesa solicitudes', async (t) => {
  const c = preparar(t, { habilitado: 'false' });

  assert.equal(c.temporizadores.length, 0);
  assert.deepEqual(c.operaciones, []);
});

test('recuperación worker: procesa como máximo cinco tareas y completa después del envío', async (t) => {
  const tareas = Array.from({ length: 6 }, (_, indice) => ({
    id_solicitud: String(indice + 1),
    correo: `persona${indice + 1}@example.invalid`,
  }));

  const c = preparar(t, { tareas });
  await c.ejecutarTemporizador();

  const esperado = ['limpiar'];

  for (const tarea of tareas.slice(0, 5)) {
    esperado.push(
      'reservar',
      `procesar:${tarea.correo}`,
      `completar:${tarea.id_solicitud}`,
    );
  }

  assert.deepEqual(c.operaciones, esperado);
  assert.equal(c.temporizadores.length, 2);
  assert.deepEqual(c.errores, []);
});

test('recuperación worker: una cola vacía termina el ciclo y programa el siguiente', async (t) => {
  const c = preparar(t);

  await c.ejecutarTemporizador();

  assert.deepEqual(c.operaciones, ['limpiar', 'reservar']);
  assert.equal(c.temporizadores.length, 2);
  assert.deepEqual(c.errores, []);
});

test('recuperación worker: un fallo conserva la reserva y no continúa con otra tarea en el mismo ciclo', async (t) => {
  const c = preparar(t, {
    tareas: [
      { id_solicitud: '1', correo: 'primera@example.invalid' },
      { id_solicitud: '2', correo: 'segunda@example.invalid' },
    ],
    async procesar() {
      throw new Error('Detalle que no debe aparecer en logs');
    },
  });

  await c.ejecutarTemporizador();

  assert.deepEqual(c.operaciones, [
    'limpiar',
    'reservar',
    'procesar:primera@example.invalid',
  ]);
  assert.equal(c.errores.length, 1);
  assert.ok(!c.errores[0].includes('Detalle'));
  assert.ok(!c.errores[0].includes('primera@example.invalid'));
  assert.equal(c.temporizadores.length, 2);
});

test('recuperación worker: no solapa ciclos y espera la tarea activa durante el apagado', async (t) => {
  let liberar;
  const pendiente = new Promise((resolve) => {
    liberar = resolve;
  });

  const c = preparar(t, {
    tareas: [
      { id_solicitud: '1', correo: 'persona@example.invalid' },
      { id_solicitud: '2', correo: 'otra@example.invalid' },
    ],
    procesar: () => pendiente,
  });

  try {
    await c.ejecutarTemporizador();

    // No hay otro temporizador mientras la operación sigue pendiente.
    assert.equal(c.temporizadores.length, 1);

    let apagadoTerminado = false;
    const apagado = c.worker.beforeApplicationShutdown().then(() => {
      apagadoTerminado = true;
    });

    await esperarTurno();
    assert.equal(apagadoTerminado, false);

    liberar();
    await apagado;

    assert.equal(apagadoTerminado, true);
    assert.deepEqual(c.operaciones, [
      'limpiar',
      'reservar',
      'procesar:persona@example.invalid',
      'completar:1',
    ]);

    // No reserva otra tarea ni vuelve a programarse tras el apagado.
    assert.equal(c.temporizadores.length, 1);
  } finally {
    liberar();
  }
});