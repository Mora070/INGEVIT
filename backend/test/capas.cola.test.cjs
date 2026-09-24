require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getCapasTrabajadorConfig,
} = require('../dist/modules/capas/config/capas-trabajador.config');

const {
    CapasColaService,
} = require('../dist/modules/capas/capas-cola.service');

test('trabajador capas: queda desactivado por defecto', () => {
    assert.deepEqual(getCapasTrabajadorConfig({}), {
        habilitado: false,
        intervaloMs: 5000,
    });
});

test('trabajador capas: admite activación e intervalo explícitos', () => {
    assert.deepEqual(getCapasTrabajadorConfig({
        CAPAS_TRABAJADOR_HABILITADO: 'true',
        CAPAS_TRABAJADOR_INTERVALO_MS: '1000',
    }), {
        habilitado: true,
        intervaloMs: 1000,
    });
});

test('trabajador capas: rechaza configuración inválida', () => {
    for (const valor of ['', 'TRUE', '1', ' true']) {
        assert.throws(() => getCapasTrabajadorConfig({
            CAPAS_TRABAJADOR_HABILITADO: valor,
        }));
    }

    for (const valor of [
        '', '0', '999', '-1', '1.5', '1000 ', '2147483648',
    ]) {
        assert.throws(() => getCapasTrabajadorConfig({
            CAPAS_TRABAJADOR_INTERVALO_MS: valor,
        }));
    }
});

test('cola capas: sin pendientes no inicia procesamiento', async () => {
    let llamadas = 0;

    const servicio = new CapasColaService(
        { query: async () => ({ rows: [] }) },
        {
            procesar: async () => {
                llamadas += 1;
            },
        },
    );

    assert.equal(await servicio.procesarSiguiente(), false);
    assert.equal(llamadas, 0);
});

test('cola capas: entrega la capa y el propietario al coordinador', async () => {
    const llamadas = [];

    const servicio = new CapasColaService(
        {
            query: async () => ({
                rows: [{
                    id_capa: 'capa',
                    id_proyecto: 'proyecto',
                    id_propietario: 'propietario',
                }],
            }),
        },
        {
            procesar: async (...argumentos) => {
                llamadas.push(argumentos);
            },
        },
    );

    assert.equal(await servicio.procesarSiguiente(), true);
    assert.deepEqual(llamadas, [
        ['proyecto', 'capa', 'propietario'],
    ]);
});

test('cola capas: propaga el fallo sin reintentar en el mismo ciclo', async () => {
    const fallo = new Error('Fallo controlado');
    let llamadas = 0;

    const servicio = new CapasColaService(
        {
            query: async () => ({
                rows: [{
                    id_capa: 'capa',
                    id_proyecto: 'proyecto',
                    id_propietario: 'propietario',
                }],
            }),
        },
        {
            procesar: async () => {
                llamadas += 1;
                throw fallo;
            },
        },
    );

    await assert.rejects(
        () => servicio.procesarSiguiente(),
        (error) => error === fallo,
    );

    assert.equal(llamadas, 1);
});