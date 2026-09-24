const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtemp,
    mkdir,
    writeFile,
    readFile,
    rm,
} = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const sharp = require('sharp');

const {
    auditarTeselas,
} = require('../scripts/lib/auditar-teselas.cjs');

const CAPA = '20000000-0000-4000-8000-000000000001';
const VERSION = '30000000-0000-4000-8000-000000000002';
const CLAVE = `${CAPA}/${VERSION}`;

function referencia(cambios = {}) {
    return {
        id_capa: CAPA,
        estado_procesamiento: 'LISTA',
        procesamiento_vence: null,
        vigencia_vencida: null,
        teselas_version: VERSION,
        teselas_proveedor: 'LOCAL',
        teselas_zoom_min: 12,
        teselas_zoom_max: 12,
        teselas_total: '1',
        ...cambios,
    };
}

async function conDirectorio(operacion) {
    const raiz = await mkdtemp(
        join(tmpdir(), 'ingevit-auditoria-teselas-'),
    );

    try {
        await operacion(raiz);
    } finally {
        await rm(raiz, { recursive: true, force: true });
    }
}

async function crearVersion(raiz) {
    const carpeta = join(
        raiz,
        'capas-teselas',
        CAPA,
        VERSION,
        'tiles',
        '12',
        '100',
    );

    await mkdir(carpeta, { recursive: true });

    const png = await sharp({
        create: {
            width: 256,
            height: 256,
            channels: 4,
            background: { r: 20, g: 80, b: 120, alpha: 1 },
        },
    }).png().toBuffer();

    const ruta = join(carpeta, '200.png');
    await writeFile(ruta, png);

    return { ruta, png };
}

test('auditoría: verifica una publicación sin modificar sus archivos', async () => {
    await conDirectorio(async raiz => {
        const { ruta, png } = await crearVersion(raiz);

        const resultado = await auditarTeselas(
            raiz,
            [referencia()],
            [],
        );

        assert.deepEqual(resultado.referenciadasVerificadas, [CLAVE]);
        assert.deepEqual(resultado.versionesSinReferencia, []);
        assert.deepEqual(resultado.referenciadasConProblemas, []);
        assert.deepEqual(await readFile(ruta), png);
    });
});

test('auditoría: detecta una referencia cuyo directorio no existe', async () => {
    await conDirectorio(async raiz => {
        const resultado = await auditarTeselas(
            raiz,
            [referencia()],
            [],
        );

        assert.equal(resultado.categoriaAusente, true);
        assert.deepEqual(resultado.referenciasSinDirectorio, [CLAVE]);
    });
});

test('auditoría: distingue versiones sin referencia de intentos activos', async () => {
    await conDirectorio(async raiz => {
        await crearVersion(raiz);

        const sinReferencia = await auditarTeselas(raiz, [], []);
        assert.deepEqual(sinReferencia.versionesSinReferencia, [CLAVE]);

        const activa = await auditarTeselas(raiz, [
            referencia({
                estado_procesamiento: 'PROCESANDO',
                teselas_version: null,
                teselas_proveedor: null,
                procesamiento_vence: new Date(),
                vigencia_vencida: false,
            }),
        ], []);

        assert.deepEqual(activa.versionesSinReferencia, []);
        assert.deepEqual(activa.versionesDeIntentosActivos, [CLAVE]);
    });
});

test('auditoría: reconoce tareas de limpieza y conflictos con referencias', async () => {
    await conDirectorio(async raiz => {
        await crearVersion(raiz);

        const tareas = [{
            id_capa: CAPA,
            teselas_version: VERSION,
        }];

        const pendiente = await auditarTeselas(raiz, [], tareas);

        assert.deepEqual(pendiente.versionesSinReferencia, []);
        assert.deepEqual(pendiente.pendientesSinDirectorio, []);

        const conflicto = await auditarTeselas(
            raiz,
            [referencia()],
            tareas,
        );

        assert.deepEqual(
            conflicto.pendientesTodaviaReferenciadas,
            [CLAVE],
        );
        assert.deepEqual(conflicto.tareasConCapaExistente, [CAPA]);
    });
});

test('auditoría: identifica un PNG dañado sin eliminarlo', async () => {
    await conDirectorio(async raiz => {
        const { ruta } = await crearVersion(raiz);
        const contenido = Buffer.from('archivo dañado');

        await writeFile(ruta, contenido);

        const resultado = await auditarTeselas(
            raiz,
            [referencia()],
            [],
        );

        assert.equal(resultado.referenciadasConProblemas.length, 1);
        assert.equal(
            resultado.referenciadasConProblemas[0].clave,
            CLAVE,
        );
        assert.deepEqual(await readFile(ruta), contenido);
    });
});