const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');

const {
    getTeselasConfig,
} = require('../dist/modules/capas/config/teselas.config');

const {
    construirArgumentosTeselas,
} = require('../dist/modules/capas/utils/construir-argumentos-teselas');

function entorno(cambios = {}) {
    return {
        CAPAS_GDAL_PATH: resolve('gdal-prueba', 'gdal.exe'),
        CAPAS_TESELAS_ZOOM_MIN: '12',
        CAPAS_TESELAS_ZOOM_MAX: '18',
        CAPAS_TESELAS_HILOS: '2',
        CAPAS_TESELAS_TIMEOUT_MS: '600000',
        CAPAS_TESELAS_MAX_ARCHIVOS: '10000',
        ...cambios,
    };
}

test('teselas: obtiene una configuración explícita sin modificar el entorno', () => {
    const env = Object.freeze(entorno());

    assert.deepEqual(getTeselasConfig(env), {
        ejecutable: env.CAPAS_GDAL_PATH,
        zoomMin: 12,
        zoomMax: 18,
        hilos: 2,
        timeoutMs: 600000,
        maxArchivos: 10000,
    });
});

test('teselas: exige las variables de procesamiento', () => {
    for (const campo of Object.keys(entorno())) {
        const env = entorno();
        delete env[campo];

        assert.throws(
            () => getTeselasConfig(env),
            new RegExp(campo),
        );
    }
});

test('teselas: rechaza rutas y límites inválidos', () => {
    for (const cambio of [
        { CAPAS_GDAL_PATH: 'gdal.exe' },
        { CAPAS_GDAL_PATH: `${resolve('gdal.exe')}\n` },
        { CAPAS_TESELAS_ZOOM_MIN: '-1' },
        { CAPAS_TESELAS_ZOOM_MIN: '12.5' },
        { CAPAS_TESELAS_ZOOM_MAX: '31' },
        { CAPAS_TESELAS_ZOOM_MAX: '18\n' },
        { CAPAS_TESELAS_HILOS: '0' },
        { CAPAS_TESELAS_HILOS: '17' },
        { CAPAS_TESELAS_HILOS: 'ALL_CPUS' },
        { CAPAS_TESELAS_TIMEOUT_MS: '0' },
        { CAPAS_TESELAS_TIMEOUT_MS: '1e6' },
        { CAPAS_TESELAS_TIMEOUT_MS: '2147483648' },
        { CAPAS_TESELAS_MAX_ARCHIVOS: '0' },
        { CAPAS_TESELAS_MAX_ARCHIVOS: '-1' },
        { CAPAS_TESELAS_MAX_ARCHIVOS: '1.5' },
        { CAPAS_TESELAS_MAX_ARCHIVOS: '9007199254740992' },
    ]) {
        assert.throws(() => getTeselasConfig(entorno(cambio)));
    }
});

test('teselas: valida el intervalo y permite un único nivel de zoom', () => {
    assert.throws(
        () => getTeselasConfig(entorno({
            CAPAS_TESELAS_ZOOM_MIN: '19',
            CAPAS_TESELAS_ZOOM_MAX: '18',
        })),
        /no puede superar/,
    );

    const config = getTeselasConfig(entorno({
        CAPAS_TESELAS_ZOOM_MIN: '0',
        CAPAS_TESELAS_ZOOM_MAX: '0',
    }));

    assert.equal(config.zoomMin, 0);
    assert.equal(config.zoomMax, 0);
});

test('teselas: construye el comando PNG XYZ con rutas como argumentos separados', () => {
    const config = getTeselasConfig(entorno());
    const entrada = resolve('originales', 'archivo con espacios.tif');
    const salida = resolve('generaciones', 'version de prueba');

    assert.deepEqual(
        construirArgumentosTeselas(entrada, salida, config),
        [
            'raster', 'tile',
            '--input-format', 'GTiff',
            '--open-option', 'GEOREF_SOURCES=INTERNAL',
            '--output-format', 'PNG',
            '--tiling-scheme', 'WebMercatorQuad',
            '--convention', 'xyz',
            '--tile-size', '256',
            '--min-zoom', '12',
            '--max-zoom', '18',
            '--resampling', 'bilinear',
            '--overview-resampling', 'average',
            '--add-alpha',
            '--num-threads', '2',
            '--parallel-method', 'thread',
            '--webviewer', 'none',
            '--input', entrada,
            '--output', salida,
        ],
    );
});

test('teselas: rechaza rutas inválidas y destinos que contienen el original', () => {
    const config = getTeselasConfig(entorno());
    const salida = resolve('generaciones', 'version');

    for (const [entrada, destino] of [
        ['original.tif', salida],
        [resolve('original.tif'), 'salida-relativa'],
        [`${resolve('original.tif')}\0`, salida],
        [salida, salida],
        [resolve(salida, 'original.tif'), salida],
    ]) {
        assert.throws(
            () => construirArgumentosTeselas(entrada, destino, config),
        );
    }
});

test('teselas: distingue carpetas hermanas con prefijos similares', () => {
    const config = getTeselasConfig(entorno());

    assert.doesNotThrow(() => construirArgumentosTeselas(
        resolve('generaciones', 'version-original', 'original.tif'),
        resolve('generaciones', 'version'),
        config,
    ));
});