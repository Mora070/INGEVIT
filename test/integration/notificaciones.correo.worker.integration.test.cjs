require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
    NotificacionesCorreoService,
} = require(
    '../../dist/modules/notificaciones/correos/notificaciones-correo.service'
);

const {
    NotificacionesCorreoWorker,
} = require(
    '../../dist/modules/notificaciones/correos/notificaciones-correo.worker'
);

function crearSenal() {
    let resolver;

    const promesa = new Promise((resolve) => {
        resolver = resolve;
    });

    return { promesa, resolver };
}

/**
 * Limita cuánto esperamos una señal.
 * El temporizador siempre se elimina cuando termina la espera.
 */
async function esperarConLimite(promesa, descripcion) {
    let temporizador;

    try {
        return await Promise.race([
            promesa,
            new Promise((_, reject) => {
                temporizador = setTimeout(() => {
                    reject(new Error(`Tiempo agotado: ${descripcion}`));
                }, 10_000);
            }),
        ]);
    } finally {
        clearTimeout(temporizador);
    }
}

/**
 * Utiliza la aplicación Nest y el temporizador reales.
 *
 * Sustituye únicamente el procesamiento de notificaciones:
 * no reserva registros ni contacta con SMTP.
 *
 * Comprueba que app.close() ejecuta el hook de apagado y espera
 * la operación que el trabajador ya había comenzado.
 */
test('worker correo: Nest lo inicia y espera la operación activa durante el apagado', async (t) => {
    const primeraLlamada = crearSenal();
    const terminarOperacion = crearSenal();
    const inicioApagado = crearSenal();

    let llamadas = 0;
    let operacionTerminada = false;
    let cierreTerminado = false;

    t.mock.method(
        NotificacionesCorreoService.prototype,
        'procesarSiguiente',
        async () => {
            llamadas += 1;
            primeraLlamada.resolver();

            await terminarOperacion.promesa;

            operacionTerminada = true;
            return 'ENVIADA';
        },
    );

    // Esta prueba comprueba el ciclo de vida, no modifica la cola real.
    t.mock.method(
        NotificacionesCorreoService.prototype,
        'recuperarReservasVencidas',
        async () => 0,
    );

    const ejecucion = conAplicacionReal(
        async ({ app }) => {
            const worker = app.get(NotificacionesCorreoWorker);

            const apagarOriginal =
                worker.beforeApplicationShutdown.bind(worker);

            /*
             * Observamos el hook conservando su implementación real.
             * No sustituimos la espera ni el comportamiento del trabajador.
             */
            t.mock.method(
                worker,
                'beforeApplicationShutdown',
                () => {
                    inicioApagado.resolver();
                    return apagarOriginal();
                },
            );

            await esperarConLimite(
                primeraLlamada.promesa,
                'el trabajador no inició el procesamiento',
            );

            assert.equal(llamadas, 1);
            assert.equal(operacionTerminada, false);

            /*
             * Al retornar, el ayudante ejecutará app.close().
             * La operación simulada continúa pendiente.
             */
        },
        { habilitarTrabajadorCorreo: true },
    ).then(() => {
        cierreTerminado = true;
    });

    // Evita un rechazo sin manejar mientras esperamos otra señal.
    // La promesa original se comprueba explícitamente más abajo.
    ejecucion.catch(() => { });

    try {
        await esperarConLimite(
            Promise.race([
                inicioApagado.promesa,
                ejecucion.then(() => {
                    throw new Error(
                        'La aplicación cerró sin ejecutar el hook esperado.',
                    );
                }),
            ]),
            'Nest no inició el apagado del trabajador',
        );

        // Da oportunidad a que avance el cierre si no estuviera esperando.
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(cierreTerminado, false);
        assert.equal(operacionTerminada, false);
        assert.equal(llamadas, 1);

        // Permitimos terminar la operación ya iniciada.
        terminarOperacion.resolver();

        await esperarConLimite(
            ejecucion,
            'la aplicación no terminó de cerrar',
        );

        assert.equal(operacionTerminada, true);
        assert.equal(cierreTerminado, true);
        assert.equal(llamadas, 1);
    } finally {
        // Libera también la operación si una comprobación falla.
        terminarOperacion.resolver();

        await esperarConLimite(
            ejecucion,
            'limpieza de la aplicación',
        );
    }
});