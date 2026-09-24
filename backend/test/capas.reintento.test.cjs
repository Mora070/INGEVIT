require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CapasReintentoService } = require('../dist/modules/capas/capas-reintento.service');

function escenario(opciones = {}) {
    const client = {};
    const llamadas = [];
    const fila = {
        id_capa: 'capa', estado_procesamiento: 'ERROR', almacenamiento_proveedor: 'LOCAL',
        teselas_version: null, procesamiento_token: null, ...opciones.fila,
    };
    const servicio = new CapasReintentoService(
        { withTransaction: async operacion => operacion(client) },
        {
            bloquearPropietarioActivo: async c => {
                assert.equal(c, client); llamadas.push('usuario'); return opciones.activo !== false;
            },
            bloquearEditablePorPropietario: async c => {
                assert.equal(c, client); llamadas.push('proyecto'); return opciones.propietario !== false;
            },
        },
        {
            bloquear: async c => { assert.equal(c, client); llamadas.push('capa'); return opciones.ausente ? null : fila; },
            encolar: async c => { assert.equal(c, client); llamadas.push('encolar'); return opciones.encolar !== false; },
        },
        { crear: async (c, datos) => {
            assert.equal(c, client); llamadas.push('historial');
            assert.equal(datos.tipoAccion, 'CAPA_REINTENTO_SOLICITADO');
            assert.equal(datos.idActor, 'usuario');
            if (opciones.error) throw opciones.error;
        } },
    );
    return { llamadas, solicitar: () => servicio.solicitar('proyecto', 'capa', 'usuario') };
}

test('reintento: encola e incorpora historial en la misma transacción', async () => {
    const e = escenario();
    assert.deepEqual(await e.solicitar(), { id_capa: 'capa', estado_procesamiento: 'PENDIENTE' });
    assert.deepEqual(e.llamadas, ['usuario', 'proyecto', 'capa', 'encolar', 'historial']);
});
test('reintento: una cuenta inactiva no modifica la capa', async () => {
    const e = escenario({ activo: false });
    await assert.rejects(e.solicitar(), error => error.getStatus() === 401);
    assert.deepEqual(e.llamadas, ['usuario']);
});
test('reintento: solo el propietario puede solicitarlo', async () => {
    const e = escenario({ propietario: false });
    await assert.rejects(e.solicitar(), error => error.getStatus() === 404);
    assert.deepEqual(e.llamadas, ['usuario', 'proyecto']);
});
test('reintento: capa inexistente devuelve 404', async () => {
    const e = escenario({ ausente: true });
    await assert.rejects(e.solicitar(), error => error.getStatus() === 404);
    assert.equal(e.llamadas.includes('encolar'), false);
});
test('reintento: protege capas pendientes, activas y publicadas', async () => {
    for (const fila of [
        { estado_procesamiento: 'PENDIENTE' }, { estado_procesamiento: 'PROCESANDO' },
        { estado_procesamiento: 'LISTA' }, { teselas_version: 'version' },
        { procesamiento_token: 'intento' }, { almacenamiento_proveedor: 'S3' },
    ]) {
        const e = escenario({ fila });
        await assert.rejects(e.solicitar(), error => error.getStatus() === 409);
        assert.equal(e.llamadas.includes('encolar'), false);
    }
});
test('reintento: no registra éxito si la transición fue rechazada', async () => {
    const e = escenario({ encolar: false });
    await assert.rejects(e.solicitar(), error => error.getStatus() === 409);
    assert.equal(e.llamadas.includes('historial'), false);
});
test('reintento: propaga el fallo del historial para revertir la transacción', async () => {
    const error = new Error('Historial fallido');
    const e = escenario({ error });
    await assert.rejects(e.solicitar(), recibido => recibido === error);
});
