const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getSubidaCapaConfig,
} = require('../dist/modules/capas/config/subida-capa.config');

test('subida de capas: queda deshabilitada sin un límite configurado', () => {
    assert.deepEqual(getSubidaCapaConfig({}), {
        habilitada: false,
        maxArchivoBytes: null,
    });
});

test('subida de capas: acepta un límite explícito sin modificar el entorno', () => {
    // Valor exclusivo de la prueba; no establece el límite del producto.
    const env = Object.freeze({
        CAPAS_MAX_ARCHIVO_BYTES: '1048576',
    });

    assert.deepEqual(getSubidaCapaConfig(env), {
        habilitada: true,
        maxArchivoBytes: 1048576,
    });
    assert.equal(env.CAPAS_MAX_ARCHIVO_BYTES, '1048576');
});

test('subida de capas: una configuración vacía es un error', () => {
    for (const valor of ['', ' ', '\t', '\n']) {
        assert.throws(
            () => getSubidaCapaConfig({
                CAPAS_MAX_ARCHIVO_BYTES: valor,
            }),
            /CAPAS_MAX_ARCHIVO_BYTES/,
        );
    }
});

test('subida de capas: rechaza tamaños y formatos ambiguos', () => {
    for (const valor of [
        '0',
        '-1',
        '1.5',
        '+100',
        '0100',
        '1e6',
        '0x100',
        '1_000',
        '100 MB',
        ' 100',
        '100 ',
        '100\n',
        '100\r\n',
        'NaN',
        'Infinity',
    ]) {
        assert.throws(
            () => getSubidaCapaConfig({
                CAPAS_MAX_ARCHIVO_BYTES: valor,
            }),
            /CAPAS_MAX_ARCHIVO_BYTES/,
            `Debió rechazar ${JSON.stringify(valor)}`,
        );
    }
});

test('subida de capas: rechaza tipos distintos de texto', () => {
    for (const valor of [null, 100, true, {}, ['100']]) {
        assert.throws(
            () => getSubidaCapaConfig({
                CAPAS_MAX_ARCHIVO_BYTES: valor,
            }),
            /CAPAS_MAX_ARCHIVO_BYTES/,
        );
    }
});

test('subida de capas: conserva precisión para detectar el exceso de tamaño', () => {
    const maximoRepresentable = Number.MAX_SAFE_INTEGER - 1;

    assert.deepEqual(
        getSubidaCapaConfig({
            CAPAS_MAX_ARCHIVO_BYTES: String(maximoRepresentable),
        }),
        {
            habilitada: true,
            maxArchivoBytes: maximoRepresentable,
        },
    );

    for (const valor of [
        String(Number.MAX_SAFE_INTEGER),
        '9007199254740992',
        '999999999999999999999999999999999999',
    ]) {
        assert.throws(
            () => getSubidaCapaConfig({
                CAPAS_MAX_ARCHIVO_BYTES: valor,
            }),
            /rango técnico/,
        );
    }
});