require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');

const config = require(
  '../dist/modules/almacenamiento/config/archivos-pendientes.config',
);

const {
  ArchivosPendientesWorker,
} = require('../dist/modules/almacenamiento/archivos-pendientes.worker');

/**
 * Permite que terminen las promesas del ciclo sin avanzar
 * los temporizadores simulados.
 */
function terminarPromesas() {
  return new Promise((resolve) => setImmediate(resolve));
}

function preparar(t, procesar, opciones = {}) {
  const temporizadores = new Set();
  const avisos = [];

  t.mock.method(config, 'getArchivosPendientesConfig', () => ({
    habilitado: true,
    intervaloMs: 5000,
    demoraReintentoSegundos: 60,
    maxTareasPorCiclo: 3,
    ...opciones,
  }));

  /*
   * Sustituimos la programación, no la lógica del trabajador.
   * Ningún temporizador simulado se ejecuta por sí solo.
   */
  t.mock.method(global, 'setTimeout', (callback, demora) => {
    const temporizador = {
      callback,
      demora,
      unref() {
        return this;
      },
    };

    temporizadores.add(temporizador);
    return temporizador;
  });

  t.mock.method(global, 'clearTimeout', (temporizador) => {
    temporizadores.delete(temporizador);
  });

  t.mock.method(Logger.prototype, 'warn', (mensaje) => {
    avisos.push(mensaje);
  });

  const worker = new ArchivosPendientesWorker({
    procesarSiguienteConReintento: procesar,
  });

  function dispararTemporizador() {
    assert.equal(temporizadores.size, 1);

    const [temporizador] = temporizadores;
    temporizadores.delete(temporizador);

    assert.equal(temporizador.demora, 5000);
    temporizador.callback();
  }

  return {
    worker,
    temporizadores,
    avisos,
    dispararTemporizador,
  };
}

test(
  'worker: no programa tareas cuando está desactivado',
  async (t) => {
    let llamadas = 0;

    const { worker, temporizadores } = preparar(
      t,
      async () => {
        llamadas += 1;
        return true;
      },
      { habilitado: false },
    );

    try {
      worker.onApplicationBootstrap();

      assert.equal(temporizadores.size, 0);
      assert.equal(llamadas, 0);
    } finally {
      await worker.beforeApplicationShutdown();
    }
  },
);

test(
  'worker: limita las tareas por ciclo y programa un único ciclo posterior',
  async (t) => {
    const demoras = [];

    const {
      worker,
      temporizadores,
      dispararTemporizador,
    } = preparar(t, async (demora) => {
      demoras.push(demora);
      return true;
    });

    try {
      worker.onApplicationBootstrap();
      worker.onApplicationBootstrap();

      // Repetir el hook no duplica la programación.
      assert.equal(temporizadores.size, 1);

      dispararTemporizador();
      await terminarPromesas();

      assert.deepEqual(demoras, [60, 60, 60]);
      assert.equal(temporizadores.size, 1);
    } finally {
      await worker.beforeApplicationShutdown();
    }

    assert.equal(temporizadores.size, 0);
  },
);

test(
  'worker: termina el ciclo cuando no hay una tarea disponible',
  async (t) => {
    let llamadas = 0;

    const {
      worker,
      temporizadores,
      dispararTemporizador,
    } = preparar(t, async () => {
      llamadas += 1;
      return false;
    });

    try {
      worker.onApplicationBootstrap();
      dispararTemporizador();
      await terminarPromesas();

      assert.equal(llamadas, 1);
      assert.equal(temporizadores.size, 1);
    } finally {
      await worker.beforeApplicationShutdown();
    }
  },
);

test(
  'worker: contiene el fallo y espera al siguiente ciclo',
  async (t) => {
    let llamadas = 0;

    const {
      worker,
      temporizadores,
      avisos,
      dispararTemporizador,
    } = preparar(t, async () => {
      llamadas += 1;
      throw new Error('Detalle interno de prueba');
    });

    try {
      worker.onApplicationBootstrap();
      dispararTemporizador();
      await terminarPromesas();

      assert.equal(llamadas, 1);
      assert.equal(temporizadores.size, 1);
      assert.equal(avisos.length, 1);
      assert.equal(
        avisos[0].includes('Detalle interno de prueba'),
        false,
      );
    } finally {
      await worker.beforeApplicationShutdown();
    }
  },
);

test(
  'worker: no superpone ciclos y espera la tarea en curso durante el apagado',
  async (t) => {
    let liberar;
    const pendiente = new Promise((resolve) => {
      liberar = resolve;
    });

    let llamadas = 0;

    const {
      worker,
      temporizadores,
      dispararTemporizador,
    } = preparar(t, async () => {
      llamadas += 1;
      return pendiente;
    });

    try {
      worker.onApplicationBootstrap();
      dispararTemporizador();
      await terminarPromesas();

      assert.equal(llamadas, 1);

      // No programa otro ciclo mientras la operación sigue pendiente.
      assert.equal(temporizadores.size, 0);

      let apagadoTerminado = false;

      const apagado = worker.beforeApplicationShutdown().then(() => {
        apagadoTerminado = true;
      });

      await terminarPromesas();
      assert.equal(apagadoTerminado, false);

      liberar(true);
      await apagado;

      assert.equal(apagadoTerminado, true);

      // Aunque quedaba cupo en el ciclo, no inicia más tareas al apagar.
      assert.equal(llamadas, 1);
      assert.equal(temporizadores.size, 0);
    } finally {
      liberar(true);
      await worker.beforeApplicationShutdown();
    }
  },
);