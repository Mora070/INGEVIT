require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: ceder } = require('node:timers/promises');
const { conVigenciaCapa } = require('../dist/modules/capas/utils/vigencia-capa');
const { ResultadoTransaccionDesconocidoError } = require('../dist/database/errors/resultado-transaccion-desconocido.error');

function pendiente() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}
function reloj(t) {
    const tareas = new Map();
    t.mock.method(global, 'setTimeout', callback => {
        const id = { unref() {} };
        tareas.set(id, callback);
        return id;
    });
    t.mock.method(global, 'clearTimeout', id => tareas.delete(id));
    return {
        cantidad: () => tareas.size,
        disparar() {
            assert.equal(tareas.size, 1);
            const [id, callback] = tareas.entries().next().value;
            tareas.delete(id);
            callback();
        },
    };
}

test('vigencia: no inicia archivos si el permiso inicial fue rechazado', async () => {
    let operaciones = 0;
    await assert.rejects(conVigenciaCapa(async () => false, async () => { operaciones++; }), e => e.getStatus() === 409);
    assert.equal(operaciones, 0);
});

test('vigencia: termina y retira el temporizador', async t => {
    const tiempo = reloj(t);
    assert.equal(await conVigenciaCapa(async () => true, async comprobar => {
        comprobar(); return 'lista';
    }), 'lista');
    assert.equal(tiempo.cantidad(), 0);
});

test('vigencia: perder la renovación impide publicar', async t => {
    const tiempo = reloj(t);
    const inicio = pendiente(), continuar = pendiente();
    let renovaciones = 0;
    const operacion = conVigenciaCapa(async () => ++renovaciones === 1, async comprobar => {
        inicio.resolve(); await continuar.promise; comprobar();
    });
    const rechazo = assert.rejects(operacion, e => e.getStatus() === 409);
    await inicio.promise;
    tiempo.disparar(); await ceder();
    assert.equal(tiempo.cantidad(), 0);
    continuar.resolve(); await rechazo;
});

test('vigencia: un error al renovar también impide publicar', async t => {
    const tiempo = reloj(t);
    const inicio = pendiente(), continuar = pendiente();
    let llamadas = 0;
    const operacion = conVigenciaCapa(async () => {
        if (++llamadas > 1) throw new Error('Conexión interrumpida');
        return true;
    }, async comprobar => { inicio.resolve(); await continuar.promise; comprobar(); });
    const rechazo = assert.rejects(operacion, e => e.getStatus() === 409);
    await inicio.promise;
    tiempo.disparar(); await ceder();
    continuar.resolve(); await rechazo;
    assert.equal(tiempo.cantidad(), 0);
});

test('vigencia: no solapa renovaciones mientras PostgreSQL responde', async t => {
    const tiempo = reloj(t);
    const inicio = pendiente(), continuar = pendiente(), respuesta = pendiente();
    let llamadas = 0;
    const operacion = conVigenciaCapa(async () => {
        if (++llamadas === 1) return true;
        return respuesta.promise;
    }, async comprobar => { inicio.resolve(); await continuar.promise; comprobar(); });
    await inicio.promise;
    tiempo.disparar(); await ceder();
    assert.equal(llamadas, 2);
    assert.equal(tiempo.cantidad(), 0);
    respuesta.resolve(true); await ceder();
    assert.equal(tiempo.cantidad(), 1);
    continuar.resolve(); await operacion;
    assert.equal(tiempo.cantidad(), 0);
});

test('vigencia: espera la renovación activa sin reemplazar un éxito confirmado', async t => {
    const tiempo = reloj(t);
    const inicio = pendiente(), continuar = pendiente(), respuesta = pendiente();
    let llamadas = 0, termino = false;
    const operacion = conVigenciaCapa(async () => {
        if (++llamadas === 1) return true;
        return respuesta.promise;
    }, async () => { inicio.resolve(); await continuar.promise; return 'confirmada'; });
    operacion.then(() => { termino = true; });
    await inicio.promise;
    tiempo.disparar(); await ceder();
    continuar.resolve(); await ceder();
    assert.equal(termino, false);
    respuesta.resolve(false);
    assert.equal(await operacion, 'confirmada');
    assert.equal(tiempo.cantidad(), 0);
});

test('vigencia: conserva el error de una confirmación incierta', async t => {
    const tiempo = reloj(t);
    const error = new ResultadoTransaccionDesconocidoError('COMMIT', new Error('Sin respuesta'));
    await assert.rejects(conVigenciaCapa(async () => true, async () => { throw error; }), e => e === error);
    assert.equal(tiempo.cantidad(), 0);
});
