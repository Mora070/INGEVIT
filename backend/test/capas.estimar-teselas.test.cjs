require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    estimarTeselas,
    LATITUD_MAX_MERCATOR,
} = require('../dist/modules/capas/utils/estimar-teselas');

const MUNDO = [
    -180,
    -LATITUD_MAX_MERCATOR,
    180,
    LATITUD_MAX_MERCATOR,
];

function config(cambios = {}) {
    return {
        zoomMin: 0,
        zoomMax: 2,
        maxArchivos: 10000,
        ...cambios,
    };
}

function esRechazo(error) {
    assert.equal(error.getStatus(), 422);
    return true;
}

test('estimación de teselas: suma todos los niveles sin superar los bordes mundiales', () => {
    // Zoom 0: 1; zoom 1: 4; zoom 2: 16.
    assert.equal(estimarTeselas(MUNDO, config()), 21);
});

test('estimación de teselas: acepta el máximo exacto y rechaza su exceso', () => {
    assert.equal(
        estimarTeselas(MUNDO, config({ maxArchivos: 21 })),
        21,
    );

    assert.throws(
        () => estimarTeselas(MUNDO, config({ maxArchivos: 20 })),
        esRechazo,
    );
});

test('estimación de teselas: maneja conteos enormes sin perder precisión', () => {
    assert.throws(
        () => estimarTeselas(MUNDO, config({
            zoomMin: 30,
            zoomMax: 30,
            maxArchivos: Number.MAX_SAFE_INTEGER,
        })),
        esRechazo,
    );
});

test('estimación de teselas: rechaza extensiones inválidas o fuera de Web Mercator', () => {
    for (const bbox of [
        null,
        [],
        [-74, 4, -74, 5],
        [-74, 5, -73, 4],
        [179, 4, -179, 5],
        [-181, 4, -73, 5],
        [-74, -86, -73, 5],
        [-74, 4, -73, 86],
        [-74, 4, Infinity, 5],
        ['-74', 4, -73, 5],
    ]) {
        assert.throws(
            () => estimarTeselas(bbox, config()),
            esRechazo,
        );
    }
});

test('estimación de teselas: rechaza configuraciones internas inválidas', () => {
    for (const cambios of [
        { zoomMin: -1 },
        { zoomMin: 3 },
        { zoomMax: 31 },
        { zoomMax: 1.5 },
        { maxArchivos: 0 },
        { maxArchivos: '10000' },
        { maxArchivos: Infinity },
    ]) {
        assert.throws(
            () => estimarTeselas(MUNDO, config(cambios)),
            /configuración/,
        );
    }
});

test('estimación de teselas: admite un área local y no modifica sus datos', () => {
    const bbox = Object.freeze([-74.1, 4.6, -74, 4.7]);
    const limites = Object.freeze(config({
        zoomMin: 12,
        zoomMax: 14,
    }));

    const resultado = estimarTeselas(bbox, limites);

    assert.ok(Number.isSafeInteger(resultado));
    assert.ok(resultado > 0);
    assert.ok(resultado <= limites.maxArchivos);
    assert.deepEqual(bbox, [-74.1, 4.6, -74, 4.7]);

    assert.equal(
        estimarTeselas(bbox, config({ zoomMin: 0, zoomMax: 0 })),
        1,
    );
});