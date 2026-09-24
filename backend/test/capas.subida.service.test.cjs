require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');

const {
    CapasSubidaService,
} = require('../dist/modules/capas/capas-subida.service');

const RUTA = resolve('temporal-prueba', 'original.bin');
const DATOS = { nombre: 'Ortofoto', descripcion: '' };
const METADATOS = {
    ancho: 16,
    alto: 8,
    crsOriginal: 'WKT verificado',
    bbox: [-74.1, 4.6, -74, 4.7],
};

function archivo(cambios = {}) {
    return {
        path: RUTA,
        size: 2048,
        originalname: 'levantamiento.tif',
        ...cambios,
    };
}

test('subida de capa: inspecciona antes de guardar y transmite los metadatos verificados', async () => {
    const eventos = [];
    const respuesta = { id_capa: 'capa', estado_procesamiento: 'PENDIENTE' };

    const servicio = new CapasSubidaService(
        {
            async inspeccionar(ruta) {
                eventos.push('inspeccionar');
                assert.equal(ruta, RUTA);
                return METADATOS;
            },
        },
        {
            async guardarYRegistrar(...argumentos) {
                eventos.push('guardar');
                assert.deepEqual(argumentos, [
                    'proyecto',
                    'usuario',
                    DATOS,
                    {
                        rutaTemporal: RUTA,
                        nombreOriginal: 'levantamiento.tif',
                        tamanoBytes: 2048,
                        metadatos: METADATOS,
                    },
                ]);
                return respuesta;
            },
        },
    );

    assert.equal(
        await servicio.subir('proyecto', 'usuario', DATOS, archivo()),
        respuesta,
    );
    assert.deepEqual(eventos, ['inspeccionar', 'guardar']);
});

test('subida de capa: conserva únicamente el nombre informativo del archivo', async () => {
    for (const originalname of [
        'C:\\documentos\\levantamiento.tif',
        '/documentos/levantamiento.tif',
        'levantamiento.tif',
    ]) {
        const servicio = new CapasSubidaService(
            { async inspeccionar() { return METADATOS; } },
            {
                async guardarYRegistrar(_proyecto, _usuario, _datos, original) {
                    assert.equal(original.nombreOriginal, 'levantamiento.tif');
                    assert.equal(original.rutaTemporal, RUTA);
                    return {};
                },
            },
        );

        await servicio.subir(
            'proyecto', 'usuario', DATOS, archivo({ originalname }),
        );
    }
});

test('subida de capa: rechaza temporales inválidos antes de inspeccionar', async () => {
    let llamadas = 0;

    const servicio = new CapasSubidaService(
        { async inspeccionar() { llamadas += 1; } },
        { async guardarYRegistrar() { llamadas += 1; } },
    );

    for (const entrada of [
        undefined,
        archivo({ path: 'relativa.bin' }),
        archivo({ path: `${RUTA}\0` }),
        archivo({ size: 0 }),
        archivo({ size: -1 }),
        archivo({ size: 1.5 }),
        archivo({ size: '2048' }),
    ]) {
        await assert.rejects(
            servicio.subir('proyecto', 'usuario', DATOS, entrada),
            (error) => error.getStatus() === 400,
        );
    }

    assert.equal(llamadas, 0);
});

test('subida de capa: rechaza nombres originales inválidos', async () => {
    let llamadas = 0;

    const servicio = new CapasSubidaService(
        { async inspeccionar() { llamadas += 1; } },
        { async guardarYRegistrar() { llamadas += 1; } },
    );

    for (const originalname of ['', ' ', '.', '..', null, 'foto\0.tif', 'foto\n.tif']) {
        await assert.rejects(
            servicio.subir(
                'proyecto', 'usuario', DATOS, archivo({ originalname }),
            ),
            (error) => error.getStatus() === 400,
        );
    }

    assert.equal(llamadas, 0);
});

test('subida de capa: no guarda el original cuando falla la inspección', async () => {
    const fallo = new Error('Archivo no procesable');
    let guardados = 0;

    const servicio = new CapasSubidaService(
        { async inspeccionar() { throw fallo; } },
        { async guardarYRegistrar() { guardados += 1; } },
    );

    await assert.rejects(
        servicio.subir('proyecto', 'usuario', DATOS, archivo()),
        (error) => error === fallo,
    );

    assert.equal(guardados, 0);
});

test('subida de capa: propaga el fallo de persistencia sin reintentar', async () => {
    const fallo = new Error('Fallo de registro');
    let intentos = 0;

    const servicio = new CapasSubidaService(
        { async inspeccionar() { return METADATOS; } },
        {
            async guardarYRegistrar() {
                intentos += 1;
                throw fallo;
            },
        },
    );

    await assert.rejects(
        servicio.subir('proyecto', 'usuario', DATOS, archivo()),
        (error) => error === fallo,
    );

    assert.equal(intentos, 1);
});