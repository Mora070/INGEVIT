require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    validarMetadatosGeoTiff,
} = require('../dist/modules/capas/utils/inspeccionar-geotiff');

/**
 * Representa la estructura de salida de GDAL.
 * El WKT es un marcador: estas pruebas no sustituyen la lectura de un archivo real.
 */
function informacion(cambios = {}) {
    return {
        driverShortName: 'GTiff',
        size: [2048, 1024],
        coordinateSystem: {
            wkt: 'WKT obtenido por GDAL',
        },
        geoTransform: [500000, 0.1, 0, 500000, 0, -0.1],
        wgs84Extent: {
            type: 'Polygon',
            coordinates: [[
                [-74.1, 4.7],
                [-74.1, 4.6],
                [-74.0, 4.6],
                [-74.0, 4.7],
                [-74.1, 4.7],
            ]],
        },
        ...cambios,
    };
}

function comprobarRechazo(datos) {
    assert.throws(
        () => validarMetadatosGeoTiff(datos),
        (error) => {
            assert.equal(error.getStatus(), 422);
            return true;
        },
    );
}

test('GeoTIFF: obtiene dimensiones, CRS y bbox sin modificar los metadatos', () => {
    const datos = informacion();
    const copia = structuredClone(datos);

    assert.deepEqual(validarMetadatosGeoTiff(datos), {
        ancho: 2048,
        alto: 1024,
        crsOriginal: 'WKT obtenido por GDAL',
        bbox: [-74.1, 4.6, -74, 4.7],
    });

    assert.deepEqual(datos, copia);
});

test('GeoTIFF: rechaza formatos distintos de TIFF', () => {
    for (const datos of [
        null,
        [],
        {},
        informacion({ driverShortName: 'PNG' }),
        informacion({ driverShortName: 'VRT' }),
    ]) {
        comprobarRechazo(datos);
    }
});

test('GeoTIFF: exige dimensiones enteras positivas', () => {
    for (const size of [
        undefined,
        [0, 100],
        [-1, 100],
        [100.5, 100],
        ['100', 100],
        [Infinity, 100],
        [2147483648, 100],
        [100],
    ]) {
        comprobarRechazo(informacion({ size }));
    }
});

test('GeoTIFF: exige un CRS presente y compatible con almacenamiento en texto', () => {
    for (const coordinateSystem of [
        undefined,
        null,
        {},
        { wkt: '' },
        { wkt: '   ' },
        { wkt: 123 },
        { wkt: 'WKT\0inválido' },
    ]) {
        comprobarRechazo(informacion({ coordinateSystem }));
    }
});

test('GeoTIFF: valida la transformación y admite rotación', () => {
    for (const geoTransform of [
        undefined,
        [],
        [0, 1, 0, 0, 0],
        [0, '1', 0, 0, 0, -1],
        [0, Infinity, 0, 0, 0, -1],
        [0, 0, 0, 0, 0, 0],
        [0, 1, 2, 0, 2, 4],
    ]) {
        comprobarRechazo(informacion({ geoTransform }));
    }

    assert.doesNotThrow(() => validarMetadatosGeoTiff(informacion({
        geoTransform: [500000, 0.1, 0.02, 500000, 0.02, -0.1],
    })));
});

test('GeoTIFF: exige un polígono WGS84 cerrado con coordenadas válidas', () => {
    for (const wgs84Extent of [
        undefined,
        { type: 'MultiPolygon', coordinates: [] },
        { type: 'Polygon', coordinates: [] },
        { type: 'Polygon', coordinates: [[]] },
        {
            type: 'Polygon',
            coordinates: [[
                [-74, 4], [-73, 4], [-73, 5], [-74, 5],
            ]],
        },
        {
            type: 'Polygon',
            coordinates: [[
                [-74, 4], [-73, 4], [-73, 91], [-74, 4],
            ]],
        },
        {
            type: 'Polygon',
            coordinates: [[
                [-74, 4], ['-73', 4], [-73, 5], [-74, 4],
            ]],
        },
    ]) {
        comprobarRechazo(informacion({ wgs84Extent }));
    }
});

test('GeoTIFF: rechaza extensiones sin área', () => {
    comprobarRechazo(informacion({
        wgs84Extent: {
            type: 'Polygon',
            coordinates: [[
                [-74, 4], [-73, 5], [-72, 6], [-74, 4],
            ]],
        },
    }));
});

test('GeoTIFF: rechaza extensiones que cruzan el antimeridiano', () => {
    comprobarRechazo(informacion({
        wgs84Extent: {
            type: 'Polygon',
            coordinates: [[
                [179, 4],
                [-179, 4],
                [-179, 5],
                [179, 5],
                [179, 4],
            ]],
        },
    }));
});