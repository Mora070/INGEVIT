require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');

const {
    ejecutarGdalInfo,
} = require('../dist/modules/capas/utils/ejecutar-gdalinfo');

const configuracion = Object.freeze({
    ejecutableInfo: resolve('gdal-prueba', 'gdalinfo.exe'),
    directorioDatosGdal: resolve('gdal-prueba', 'datos'),
    directorioDatosProj: resolve('gdal-prueba', 'proj'),
    timeoutInfoMs: 30000,
});

const ruta = resolve('temporales', 'capa de prueba', 'original.bin');

function comprobarEstado(estado) {
    return (error) => {
        assert.equal(error.getStatus(), estado);

        // Los errores públicos no deben revelar la salida del proceso.
        assert.equal(
            JSON.stringify(error.getResponse()).includes('DETALLE_PRIVADO'),
            false,
        );

        return true;
    };
}

function ejecutorConError(propiedades) {
    return async () => {
        throw Object.assign(
            new Error('DETALLE_PRIVADO'),
            propiedades,
        );
    };
}

test('gdalinfo: configura la ejecución sin shell y devuelve el JSON', async () => {
    const esperado = {
        driverShortName: 'GTiff',
        size: [1024, 512],
    };

    let llamadas = 0;

    const resultado = await ejecutarGdalInfo(
        ruta,
        configuracion,
        async (ejecutable, argumentos, opciones) => {
            llamadas += 1;

            assert.equal(ejecutable, configuracion.ejecutableInfo);

            assert.deepEqual(argumentos, [
                '-json',
                '-nomd',
                '-norat',
                '-noct',
                '-if',
                'GTiff',
                '-oo',
                'GEOREF_SOURCES=INTERNAL',
                ruta,
            ]);

            assert.equal(opciones.shell, false);
            assert.equal(opciones.windowsHide, true);
            assert.equal(opciones.encoding, 'utf8');
            assert.equal(opciones.timeout, 30000);
            assert.equal(opciones.maxBuffer, 4 * 1024 * 1024);

            assert.equal(
                opciones.env.GDAL_DATA,
                configuracion.directorioDatosGdal,
            );
            assert.equal(
                opciones.env.PROJ_DATA,
                configuracion.directorioDatosProj,
            );
            assert.equal(opciones.env.PROJ_NETWORK, 'OFF');
            assert.equal(opciones.env.GDAL_PAM_ENABLED, 'NO');
            assert.equal(
                opciones.env.GDAL_DISABLE_READDIR_ON_OPEN,
                'EMPTY_DIR',
            );

            return JSON.stringify(esperado);
        },
    );

    assert.deepEqual(resultado, esperado);
    assert.equal(llamadas, 1);
});

test('gdalinfo: rechaza rutas inválidas antes de ejecutar procesos', async () => {
    let llamadas = 0;

    for (const valor of [
        '',
        'original.bin',
        `${ruta}\0`,
        `${ruta}\n`,
        null,
    ]) {
        await assert.rejects(
            ejecutarGdalInfo(valor, configuracion, async () => {
                llamadas += 1;
                return '{}';
            }),
            /ruta temporal/,
        );
    }

    assert.equal(llamadas, 0);
});

test('gdalinfo: comunica que GDAL no pudo inspeccionar el archivo', async () => {
    await assert.rejects(
        ejecutarGdalInfo(
            ruta,
            configuracion,
            ejecutorConError({ code: 1 }),
        ),
        comprobarEstado(422),
    );
});

test('gdalinfo: distingue fallos de disponibilidad del ejecutable', async () => {
    for (const code of ['ENOENT', 'EACCES', 'EPERM']) {
        await assert.rejects(
            ejecutarGdalInfo(
                ruta,
                configuracion,
                ejecutorConError({ code }),
            ),
            comprobarEstado(503),
        );
    }
});

test('gdalinfo: informa cuando el proceso supera el tiempo disponible', async () => {
    await assert.rejects(
        ejecutarGdalInfo(
            ruta,
            configuracion,
            ejecutorConError({
                killed: true,
                signal: 'SIGTERM',
            }),
        ),
        comprobarEstado(504),
    );
});

test('gdalinfo: distingue exceso de salida de un tiempo agotado', async () => {
    await assert.rejects(
        ejecutarGdalInfo(
            ruta,
            configuracion,
            ejecutorConError({
                code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
                killed: true,
            }),
        ),
        comprobarEstado(422),
    );
});

test('gdalinfo: rechaza JSON inválido o resultados que no sean objetos', async () => {
    for (const salida of [
        'DETALLE_PRIVADO',
        '',
        'null',
        '[]',
        '"texto"',
        '123',
    ]) {
        await assert.rejects(
            ejecutarGdalInfo(
                ruta,
                configuracion,
                async () => salida,
            ),
            comprobarEstado(502),
        );
    }
});