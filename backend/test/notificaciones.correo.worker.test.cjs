require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');

const {
  NotificacionesCorreoWorker,
} = require(
  '../dist/modules/notificaciones/correos/notificaciones-correo.worker'
);

/**
 * Permite completar las promesas del ciclo.
 * setImmediate permanece real: solo simulamos setTimeout.
 */
function completarPromesas() {
  return new Promise((resolve) => setImmediate(resolve));
}

function prepararReloj(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  // Los errores provocados por estas pruebas no necesitan imprimirse.
  t.mock.method(Logger.prototype, 'warn', () => { });
  t.mock.method(Logger.prototype, 'error', () => { });
}

/**
 * La configuración se lee durante onApplicationBootstrap.
 * Restauramos el entorno inmediatamente después de arrancar.
 */
function iniciarTrabajador(
  t,
  procesar,
  cambios = {},
  recuperar = async () => 0,
) {
  const variables = {
    CORREO_TRABAJADOR_HABILITADO: 'true',
    CORREO_TRABAJADOR_INTERVALO_MS: '1000',
    CORREO_TRABAJADOR_MAX_POR_CICLO: '3',
    ...cambios,
  };

  const anteriores = new Map(
    Object.keys(variables).map((clave) => [
      clave,
      process.env[clave],
    ]),
  );

  const worker = new NotificacionesCorreoWorker({
    procesarSiguiente: procesar,
    recuperarReservasVencidas: recuperar,
  });

  t.after(async () => {
    await worker.beforeApplicationShutdown();
  });

  try {
    Object.assign(process.env, variables);
    worker.onApplicationBootstrap();
  } finally {
    for (const [clave, valor] of anteriores) {
      if (valor === undefined) {
        delete process.env[clave];
      } else {
        process.env[clave] = valor;
      }
    }
  }

  return worker;
}

function promesaControlada() {
  let resolver;

  const promesa = new Promise((resolve) => {
    resolver = resolve;
  });

  return { promesa, resolver };
}

test('worker correo: no procesa cuando está deshabilitado', async (t) => {
  prepararReloj(t);
  let llamadas = 0;

  iniciarTrabajador(t, async () => {
    llamadas += 1;
    return 'SIN_PENDIENTES';
  }, {
    CORREO_TRABAJADOR_HABILITADO: 'false',
  });

  t.mock.timers.tick(60_000);
  await completarPromesas();

  assert.equal(llamadas, 0);
});

test('worker correo: espera el intervalo inicial y no duplica el arranque', async (t) => {
  prepararReloj(t);
  let llamadas = 0;

  const worker = iniciarTrabajador(t, async () => {
    llamadas += 1;
    return 'SIN_PENDIENTES';
  });

  worker.onApplicationBootstrap();

  t.mock.timers.tick(999);
  await completarPromesas();
  assert.equal(llamadas, 0);

  t.mock.timers.tick(1);
  await completarPromesas();
  assert.equal(llamadas, 1);
});

test('worker correo: respeta el máximo y espera entre ciclos', async (t) => {
  prepararReloj(t);
  let llamadas = 0;

  iniciarTrabajador(t, async () => {
    llamadas += 1;

    // Ambos resultados permiten continuar dentro del mismo ciclo.
    return llamadas % 2 === 0 ? 'DESCARTADA' : 'ENVIADA';
  });

  t.mock.timers.tick(1000);
  await completarPromesas();
  assert.equal(llamadas, 3);

  t.mock.timers.tick(999);
  await completarPromesas();
  assert.equal(llamadas, 3);

  t.mock.timers.tick(1);
  await completarPromesas();
  assert.equal(llamadas, 6);
});

test('worker correo: termina el ciclo cuando no hay pendientes', async (t) => {
  prepararReloj(t);
  let llamadas = 0;

  iniciarTrabajador(t, async () => {
    llamadas += 1;
    return 'SIN_PENDIENTES';
  });

  t.mock.timers.tick(1000);
  await completarPromesas();

  // El máximo es tres, pero una cola vacía requiere una sola consulta.
  assert.equal(llamadas, 1);

  t.mock.timers.tick(1000);
  await completarPromesas();
  assert.equal(llamadas, 2);
});

test('worker correo: detiene el ciclo ante fallos y vuelve a consultar después del intervalo', async (t) => {
  prepararReloj(t);

  for (const resultado of [
    'FALLIDA',
    'RESERVA_PERDIDA',
    'EXCEPCION',
  ]) {
    let llamadas = 0;

    const worker = iniciarTrabajador(t, () => {
      llamadas += 1;

      // Comprueba también una excepción síncrona del servicio.
      if (resultado === 'EXCEPCION') {
        throw new Error('Fallo simulado');
      }

      return Promise.resolve(resultado);
    });

    try {
      t.mock.timers.tick(1000);
      await completarPromesas();
      assert.equal(llamadas, 1);

      t.mock.timers.tick(999);
      await completarPromesas();
      assert.equal(llamadas, 1);

      t.mock.timers.tick(1);
      await completarPromesas();
      assert.equal(llamadas, 2);
    } finally {
      await worker.beforeApplicationShutdown();
    }
  }
});

test('worker correo: no superpone ciclos durante una operación lenta', async (t) => {
  prepararReloj(t);
  const pendiente = promesaControlada();
  let llamadas = 0;

  const worker = iniciarTrabajador(t, () => {
    llamadas += 1;

    return llamadas === 1
      ? pendiente.promesa
      : Promise.resolve('SIN_PENDIENTES');
  }, {
    CORREO_TRABAJADOR_MAX_POR_CICLO: '1',
  });

  try {
    t.mock.timers.tick(1000);
    await completarPromesas();
    assert.equal(llamadas, 1);

    // Pasan muchos intervalos, pero la primera operación sigue activa.
    t.mock.timers.tick(60_000);
    await completarPromesas();
    assert.equal(llamadas, 1);

    pendiente.resolver('ENVIADA');
    await completarPromesas();

    // La pausa empieza cuando termina la operación, no cuando empezó.
    t.mock.timers.tick(999);
    await completarPromesas();
    assert.equal(llamadas, 1);

    t.mock.timers.tick(1);
    await completarPromesas();
    assert.equal(llamadas, 2);
  } finally {
    pendiente.resolver('ENVIADA');
    await worker.beforeApplicationShutdown();
  }
});

test('worker correo: el apagado espera la operación activa y no toma otra tarea', async (t) => {
  prepararReloj(t);
  const pendiente = promesaControlada();
  let llamadas = 0;
  let apagadoFinalizado = false;

  const worker = iniciarTrabajador(t, () => {
    llamadas += 1;
    return pendiente.promesa;
  });

  try {
    t.mock.timers.tick(1000);
    await completarPromesas();
    assert.equal(llamadas, 1);

    const apagado = worker.beforeApplicationShutdown().then(() => {
      apagadoFinalizado = true;
    });

    await completarPromesas();
    assert.equal(apagadoFinalizado, false);

    pendiente.resolver('ENVIADA');
    await apagado;

    assert.equal(apagadoFinalizado, true);
    assert.equal(llamadas, 1);

    t.mock.timers.tick(60_000);
    await completarPromesas();
    assert.equal(llamadas, 1);
  } finally {
    pendiente.resolver('ENVIADA');
    await worker.beforeApplicationShutdown();
  }
});

test('worker correo: cancela el temporizador y no vuelve a arrancar después del apagado', async (t) => {
  prepararReloj(t);
  let llamadas = 0;

  const worker = iniciarTrabajador(t, async () => {
    llamadas += 1;
    return 'SIN_PENDIENTES';
  });

  await worker.beforeApplicationShutdown();

  // Invocar otra vez el hook de arranque no debe reactivar el trabajador.
  worker.onApplicationBootstrap();

  t.mock.timers.tick(60_000);
  await completarPromesas();

  assert.equal(llamadas, 0);
});


test('worker correo: recupera reservas antes de procesar cada ciclo', async (t) => {
  prepararReloj(t);
  const eventos = [];

  iniciarTrabajador(
    t,
    async () => {
      eventos.push('procesar');
      return 'SIN_PENDIENTES';
    },
    {},
    async () => {
      eventos.push('recuperar');
      return 2;
    },
  );

  t.mock.timers.tick(1000);
  await completarPromesas();

  assert.deepEqual(eventos, ['recuperar', 'procesar']);

  t.mock.timers.tick(1000);
  await completarPromesas();

  assert.deepEqual(eventos, [
    'recuperar',
    'procesar',
    'recuperar',
    'procesar',
  ]);
});

test('worker correo: no procesa si falla la recuperación', async (t) => {
  prepararReloj(t);
  let procesamientos = 0;
  let recuperaciones = 0;

  iniciarTrabajador(
    t,
    async () => {
      procesamientos += 1;
      return 'SIN_PENDIENTES';
    },
    {},
    async () => {
      recuperaciones += 1;
      throw new Error('Fallo simulado de recuperación');
    },
  );

  t.mock.timers.tick(1000);
  await completarPromesas();

  assert.equal(recuperaciones, 1);
  assert.equal(procesamientos, 0);

  t.mock.timers.tick(1000);
  await completarPromesas();

  assert.equal(recuperaciones, 2);
  assert.equal(procesamientos, 0);
});

test('worker correo: espera la recuperación durante el apagado sin iniciar envíos', async (t) => {
  prepararReloj(t);
  const pendiente = promesaControlada();

  let procesamientos = 0;
  let recuperaciones = 0;
  let apagadoFinalizado = false;

  const worker = iniciarTrabajador(
    t,
    async () => {
      procesamientos += 1;
      return 'SIN_PENDIENTES';
    },
    {},
    () => {
      recuperaciones += 1;
      return pendiente.promesa;
    },
  );

  try {
    t.mock.timers.tick(1000);
    await completarPromesas();

    assert.equal(recuperaciones, 1);

    const apagado = worker.beforeApplicationShutdown().then(() => {
      apagadoFinalizado = true;
    });

    await completarPromesas();
    assert.equal(apagadoFinalizado, false);

    pendiente.resolver(0);
    await apagado;

    assert.equal(apagadoFinalizado, true);
    assert.equal(procesamientos, 0);

    t.mock.timers.tick(60_000);
    await completarPromesas();

    assert.equal(recuperaciones, 1);
    assert.equal(procesamientos, 0);
  } finally {
    pendiente.resolver(0);
    await worker.beforeApplicationShutdown();
  }
});