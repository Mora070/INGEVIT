require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const {
    mkdtemp,
    readFile,
    readdir,
    writeFile,
    rm,
} = require('node:fs/promises');

const {
    getGdalConfig,
} = require('../../dist/modules/capas/config/gdal.config');

const {
    inspeccionarGeoTiff,
} = require('../../dist/modules/capas/utils/inspeccionar-geotiff');

const ejecutar = promisify(execFile);

/**
 * Ejecuta GDAL real con archivos generados exclusivamente para esta prueba.
 *
 * No utiliza PostgreSQL, Mapbox ni archivos del usuario.
 * Requiere gdal_create junto a gdalinfo en la instalación configurada.
 */
test('GeoTIFF real: obtiene la ubicación, conserva el original y rechaza archivos incompatibles', async () => {
    const configuracion = getGdalConfig();

    const creador = join(
        dirname(configuracion.ejecutableInfo),
        process.platform === 'win32'
            ? 'gdal_create.exe'
            : 'gdal_create',
    );

    const directorio = await mkdtemp(
        join(tmpdir(), 'ingevit-geotiff-real-'),
    );

    const opciones = {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        timeout: configuracion.timeoutInfoMs,
        maxBuffer: 4 * 1024 * 1024,
        env: {
            ...process.env,
            GDAL_DATA: configuracion.directorioDatosGdal,
            PROJ_DATA: configuracion.directorioDatosProj,
            PROJ_NETWORK: 'OFF',
            GDAL_PAM_ENABLED: 'NO',
        },
    };

    async function huella(ruta) {
        return createHash('sha256')
            .update(await readFile(ruta))
            .digest('hex');
    }

    function esArchivoNoProcesable(error) {
        assert.equal(error.getStatus(), 422);
        return true;
    }

    try {
        /*
         * Conservamos la extensión .bin del temporal real del backend.
         * GDAL debe reconocer el formato por su contenido.
         *
         * Área:
         * oeste -74.1, sur 4.6, este -74.0, norte 4.7.
         */
        const original = join(directorio, 'original.bin');

        await ejecutar(creador, [
            '-of', 'GTiff',
            '-ot', 'Byte',
            '-outsize', '16', '8',
            '-bands', '3',
            '-burn', '80',
            '-a_srs', 'EPSG:4326',
            '-a_ullr', '-74.1', '4.7', '-74.0', '4.6',
            original,
        ], opciones);

        const huellaAntes = await huella(original);
        const archivosAntes = (await readdir(directorio)).sort();

        const metadatos = await inspeccionarGeoTiff(original);

        assert.equal(metadatos.ancho, 16);
        assert.equal(metadatos.alto, 8);
        assert.equal(typeof metadatos.crsOriginal, 'string');
        assert.match(metadatos.crsOriginal, /4326/);

        const esperado = [-74.1, 4.6, -74.0, 4.7];

        for (let indice = 0; indice < esperado.length; indice += 1) {
            assert.ok(
                Math.abs(metadatos.bbox[indice] - esperado[indice]) < 1e-8,
                `Coordenada ${indice} inesperada: ${metadatos.bbox[indice]}`,
            );
        }

        // La inspección no altera el original ni genera archivos auxiliares.
        assert.equal(await huella(original), huellaAntes);
        assert.deepEqual(
            (await readdir(directorio)).sort(),
            archivosAntes,
        );

        // Un TIFF con píxeles pero sin ubicación no es una ortofoto utilizable.
        const sinUbicacion = join(directorio, 'sin-ubicacion.tif');

        await ejecutar(creador, [
            '-of', 'GTiff',
            '-ot', 'Byte',
            '-outsize', '16', '8',
            '-bands', '3',
            '-burn', '80',
            sinUbicacion,
        ], opciones);

        await assert.rejects(
            inspeccionarGeoTiff(sinUbicacion),
            esArchivoNoProcesable,
        );

        // Un nombre terminado en .tif no convierte un archivo en GeoTIFF.
        const falso = join(directorio, 'archivo-falso.tif');
        await writeFile(falso, 'Esto no es una imagen TIFF.', 'utf8');

        await assert.rejects(
            inspeccionarGeoTiff(falso),
            esArchivoNoProcesable,
        );

        // También rechazamos otro formato de imagen, aunque tenga píxeles válidos.
        const png = join(directorio, 'imagen.png');

        await ejecutar(creador, [
            '-of', 'PNG',
            '-ot', 'Byte',
            '-outsize', '16', '8',
            '-bands', '3',
            '-burn', '80',
            png,
        ], opciones);

        await assert.rejects(
            inspeccionarGeoTiff(png),
            esArchivoNoProcesable,
        );
    } finally {
        await rm(directorio, {
            recursive: true,
            force: true,
        });
    }
});