const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve, normalize } = require('node:path');

const {
    getGdalConfig,
} = require('../dist/modules/capas/config/gdal.config');

/**
 * Las rutas son datos de prueba.
 * No requieren instalar GDAL ni ejecutar procesos.
 */
function entorno(cambios = {}) {
    return {
        CAPAS_GDALINFO_PATH: resolve('gdal-prueba', 'bin', 'gdalinfo.exe'),
        CAPAS_GDAL_DATA: resolve('gdal-prueba', 'datos'),
        CAPAS_PROJ_DATA: resolve('gdal-prueba', 'proj'),
        ...cambios,
    };
}

test('GDAL config: acepta rutas internas y aplica el tiempo predeterminado', () => {
    const env = Object.freeze(entorno());
    const copia = { ...env };

    assert.deepEqual(getGdalConfig(env), {
        ejecutableInfo: normalize(env.CAPAS_GDALINFO_PATH),
        directorioDatosGdal: normalize(env.CAPAS_GDAL_DATA),
        directorioDatosProj: normalize(env.CAPAS_PROJ_DATA),
        timeoutInfoMs: 30000,
    });

    assert.deepEqual(env, copia);
});

test('GDAL config: permite configurar el tiempo de inspección', () => {
    assert.equal(
        getGdalConfig(entorno({
            CAPAS_GDALINFO_TIMEOUT_MS: '45000',
        })).timeoutInfoMs,
        45000,
    );
});

test('GDAL config: exige las tres rutas', () => {
    for (const campo of [
        'CAPAS_GDALINFO_PATH',
        'CAPAS_GDAL_DATA',
        'CAPAS_PROJ_DATA',
    ]) {
        const env = entorno();
        delete env[campo];

        assert.throws(
            () => getGdalConfig(env),
            new RegExp(campo),
        );
    }
});

test('GDAL config: rechaza rutas relativas, vacías o con caracteres inválidos', () => {
    for (const campo of [
        'CAPAS_GDALINFO_PATH',
        'CAPAS_GDAL_DATA',
        'CAPAS_PROJ_DATA',
    ]) {
        for (const valor of [
            '',
            ' ',
            'ruta/relativa',
            ` ${resolve('gdal-prueba')}`,
            `${resolve('gdal-prueba')}\n`,
            `${resolve('gdal-prueba')}\0`,
            null,
            123,
        ]) {
            assert.throws(
                () => getGdalConfig(entorno({ [campo]: valor })),
                new RegExp(campo),
            );
        }
    }
});

test('GDAL config: conserva los espacios interiores de una ruta absoluta', () => {
    const ruta = resolve('herramientas GIS', 'bin', 'gdalinfo.exe');

    assert.equal(
        getGdalConfig(entorno({
            CAPAS_GDALINFO_PATH: ruta,
        })).ejecutableInfo,
        normalize(ruta),
    );
});

test('GDAL config: rechaza tiempos ambiguos o fuera del rango técnico', () => {
    for (const valor of [
        '',
        '0',
        '-1',
        '1.5',
        '1e3',
        '030000',
        '30000 ',
        '30000\n',
        'Infinity',
        '2147483648',
        null,
        30000,
    ]) {
        assert.throws(
            () => getGdalConfig(entorno({
                CAPAS_GDALINFO_TIMEOUT_MS: valor,
            })),
            /CAPAS_GDALINFO_TIMEOUT_MS/,
        );
    }
});