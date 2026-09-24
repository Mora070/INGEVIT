require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
} = require('node:fs/promises');
const sharp = require('sharp');

const {
    getGdalConfig,
} = require('../../dist/modules/capas/config/gdal.config');
const {
    getTeselasConfig,
} = require('../../dist/modules/capas/config/teselas.config');
const {
    inspeccionarGeoTiff,
} = require('../../dist/modules/capas/utils/inspeccionar-geotiff');
const {
    conTeselasGeneradas,
} = require('../../dist/modules/capas/utils/generar-teselas');

const ejecutar = promisify(execFile);

test('teselas reales: genera PNG XYZ, conserva el original y limpia resultados provisionales', async () => {
    const gdal = getGdalConfig();

    // Configuración exclusiva de esta prueba.
    const config = getTeselasConfig({
        ...process.env,
        CAPAS_TESELAS_ZOOM_MIN: '12',
        CAPAS_TESELAS_ZOOM_MAX: '12',
        CAPAS_TESELAS_HILOS: '1',
        CAPAS_TESELAS_TIMEOUT_MS: '60000',
        CAPAS_TESELAS_MAX_ARCHIVOS: '100',
    });

    const raiz = await mkdtemp(
        join(tmpdir(), 'ingevit-teselas-real-test-'),
    );

    try {
        const trabajo = join(raiz, 'trabajo');
        await mkdir(trabajo);

        const original = join(raiz, 'original.tif');
        const creador = join(
            dirname(gdal.ejecutableInfo),
            process.platform === 'win32'
                ? 'gdal_create.exe'
                : 'gdal_create',
        );

        await ejecutar(creador, [
            '-of', 'GTiff',
            '-ot', 'Byte',
            '-outsize', '64', '64',
            '-bands', '3',
            '-burn', '80',
            '-a_srs', 'EPSG:4326',
            '-a_ullr', '-74.1', '4.7', '-74.0', '4.6',
            original,
        ], {
            encoding: 'utf8',
            shell: false,
            windowsHide: true,
            timeout: 30000,
            maxBuffer: 4 * 1024 * 1024,
            env: {
                ...process.env,
                GDAL_DATA: gdal.directorioDatosGdal,
                PROJ_DATA: gdal.directorioDatosProj,
                PROJ_NETWORK: 'OFF',
                GDAL_PAM_ENABLED: 'NO',
            },
        });

        const bytesOriginales = await readFile(original);
        const metadatos = await inspeccionarGeoTiff(original);

        const total = await conTeselasGeneradas(
            original,
            metadatos.bbox,
            async (generacion) => {
                assert.equal(generacion.zoomMin, 12);
                assert.equal(generacion.zoomMax, 12);
                assert.equal(generacion.tamano, 256);
                assert.equal(generacion.total, generacion.teselas.length);
                assert.ok(generacion.total > 0);
                assert.ok(generacion.total <= 100);

                const claves = new Set();
                let hayPixelesVisibles = false;

                for (const tesela of generacion.teselas) {
                    assert.equal(tesela.z, 12);
                    assert.ok(tesela.x >= 0 && tesela.x < 2 ** 12);
                    assert.ok(tesela.y >= 0 && tesela.y < 2 ** 12);

                    const clave = `${tesela.z}/${tesela.x}/${tesela.y}`;
                    assert.equal(claves.has(clave), false);
                    claves.add(clave);

                    const { data, info } = await sharp(tesela.ruta)
                        .ensureAlpha()
                        .raw()
                        .toBuffer({ resolveWithObject: true });

                    assert.equal(info.width, 256);
                    assert.equal(info.height, 256);

                    for (let i = info.channels - 1; i < data.length; i += info.channels) {
                        if (data[i] > 0) {
                            hayPixelesVisibles = true;
                            break;
                        }
                    }
                }

                assert.equal(hayPixelesVisibles, true);
                return generacion.total;
            },
            config,
            gdal,
            trabajo,
        );

        assert.ok(total > 0);
        assert.deepEqual(await readdir(trabajo), []);
        assert.deepEqual(await readFile(original), bytesOriginales);

        // También limpia cuando falla quien consume la colección terminada.
        const fallo = new Error('Fallo controlado de publicación');

        await assert.rejects(
            conTeselasGeneradas(
                original,
                metadatos.bbox,
                async () => { throw fallo; },
                config,
                gdal,
                trabajo,
            ),
            (error) => error === fallo,
        );

        assert.deepEqual(await readdir(trabajo), []);
        assert.deepEqual(await readFile(original), bytesOriginales);
    } finally {
        await rm(raiz, { recursive: true, force: true });
    }
});