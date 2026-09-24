require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CapasRepository,
} = require('../dist/modules/capas/capas.repository');

function entrada(cambios = {}) {
    return {
        idProyecto: '20000000-0000-4000-8000-000000000002',
        idUsuarioSubida: '10000000-0000-4000-8000-000000000001',
        nombre: 'Ortofoto del proyecto',
        descripcion: 'Levantamiento de septiembre',
        nombreArchivoOriginal: 'levantamiento.tif',
        originalKey: 'capas/30000000-0000-4000-8000-000000000003.tif',
        tamanoOriginalBytes: 2048,
        crsOriginal: 'WKT obtenido por GDAL',
        bbox: [-74.1, 4.6, -74.0, 4.7],
        ...cambios,
    };
}

test('crear capa: parametriza los datos y conserva el orden geográfico del bbox', async () => {
    const repository = new CapasRepository();
    const datos = entrada();
    const copia = structuredClone(datos);
    const fila = {
        id_capa: '40000000-0000-4000-8000-000000000004',
        estado_procesamiento: 'PENDIENTE',
    };
    let llamadas = 0;

    const resultado = await repository.crearPendiente({
        async query(sql, valores) {
            llamadas += 1;
            assert.match(sql, /INSERT INTO obra\.capas/);
            assert.match(sql, /RETURNING \*/);

            assert.deepEqual(valores, [
                datos.idProyecto,
                datos.idUsuarioSubida,
                datos.nombre,
                datos.descripcion,
                datos.nombreArchivoOriginal,
                datos.originalKey,
                datos.tamanoOriginalBytes,
                datos.crsOriginal,
                -74.1,
                4.6,
                -74.0,
                4.7,
            ]);

            return { rowCount: 1, rows: [fila] };
        },
    }, datos);

    assert.equal(resultado, fila);
    assert.equal(llamadas, 1);
    assert.deepEqual(datos, copia);
});

test('crear capa: mantiene el texto recibido fuera de la sentencia SQL', async () => {
    const repository = new CapasRepository();
    const texto = "Ortofoto'); DROP TABLE obra.capas; --";

    await repository.crearPendiente({
        async query(sql, valores) {
            assert.equal(sql.includes(texto), false);
            assert.equal(valores[2], texto);
            assert.equal(valores[3], texto);

            return {
                rowCount: 1,
                rows: [{ id_capa: 'capa-de-prueba' }],
            };
        },
    }, entrada({
        nombre: texto,
        descripcion: texto,
    }));
});

test('crear capa: fija el proveedor local y el estado pendiente', async () => {
    const repository = new CapasRepository();

    await repository.crearPendiente({
        async query(sql, valores) {
            assert.match(sql, /'LOCAL'/);
            assert.match(sql, /'PENDIENTE'/);

            assert.equal(valores.includes('S3'), false);
            assert.equal(valores.includes('LISTA'), false);

            // El registro inicial no publica teselas ni recursos de Mapbox.
            assert.doesNotMatch(sql, /mapbox_tileset_id/);
            assert.doesNotMatch(sql, /teselas_version/);

            return {
                rowCount: 1,
                rows: [{ id_capa: 'capa-de-prueba' }],
            };
        },
    }, {
        ...entrada(),
        almacenamiento_proveedor: 'S3',
        estado_procesamiento: 'LISTA',
    });
});

test('crear capa: rechaza respuestas de inserción inconsistentes', async () => {
    const repository = new CapasRepository();

    for (const resultado of [
        { rowCount: 0, rows: [] },
        { rowCount: 1, rows: [] },
        { rowCount: null, rows: [{}] },
        { rowCount: 2, rows: [{}, {}] },
    ]) {
        await assert.rejects(
            repository.crearPendiente({
                async query() {
                    return resultado;
                },
            }, entrada()),
            /resultado inesperado/,
        );
    }
});

test('crear capa: propaga el error SQL para que el servicio revierta la transacción', async () => {
    const repository = new CapasRepository();
    const fallo = Object.assign(
        new Error('Error de PostgreSQL'),
        { code: '23505' },
    );

    await assert.rejects(
        repository.crearPendiente({
            async query() {
                throw fallo;
            },
        }, entrada()),
        (error) => error === fallo,
    );
});