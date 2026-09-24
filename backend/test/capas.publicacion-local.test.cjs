require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} = require('node:fs/promises');
const sharp = require('sharp');

const {
    publicarTeselasLocales,
} = require('../dist/modules/capas/utils/publicar-teselas-locales');
const {
    ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

async function escenario(operacion) {
    const temporal = await mkdtemp(
        join(tmpdir(), 'ingevit-publicacion-test-'),
    );

    try {
        const raiz = join(temporal, 'storage');
        await mkdir(raiz);

        const origen = join(temporal, 'tesela.png');
        await sharp({
            create: {
                width: 256,
                height: 256,
                channels: 4,
                background: { r: 80, g: 120, b: 160, alpha: 1 },
            },
        }).png().toFile(origen);

        const idCapa = randomUUID();
        const carpetaCapa = join(raiz, 'capas-teselas', idCapa);
        const generacion = {
            zoomMin: 0,
            zoomMax: 0,
            tamano: 256,
            total: 1,
            teselas: [{ z: 0, x: 0, y: 0, ruta: origen }],
        };

        await operacion({
            raiz, origen, idCapa, carpetaCapa, generacion,
        });
    } finally {
        await rm(temporal, { recursive: true, force: true });
    }
}

test('publicación local: registra únicamente una colección completa y conserva el origen', async () => {
    await escenario(async (caso) => {
        const bytes = await readFile(caso.origen);

        const resultado = await publicarTeselasLocales(
            caso.idCapa,
            caso.generacion,
            async (publicacion) => {
                assert.equal(publicacion.proveedor, 'LOCAL');
                assert.equal(publicacion.total, '1');
                assert.equal(publicacion.tamano, 256);
                assert.equal(publicacion.zoomMin, 0);
                assert.equal(publicacion.zoomMax, 0);

                const version = join(caso.carpetaCapa, publicacion.version);

                assert.deepEqual(await readdir(version), ['tiles']);
                assert.deepEqual(
                    await readFile(join(version, 'tiles', '0', '0', '0.png')),
                    bytes,
                );

                return 'registrada';
            },
            caso.raiz,
        );

        assert.equal(resultado, 'registrada');
        assert.equal((await readdir(caso.carpetaCapa)).length, 1);
        assert.deepEqual(await readFile(caso.origen), bytes);
    });
});

test('publicación local: elimina su versión si falla el registro', async () => {
    await escenario(async (caso) => {
        const fallo = new Error('Registro revertido');

        await assert.rejects(
            publicarTeselasLocales(
                caso.idCapa,
                caso.generacion,
                async () => { throw fallo; },
                caso.raiz,
            ),
            (error) => error === fallo,
        );

        assert.deepEqual(await readdir(caso.carpetaCapa), []);
        assert.ok((await readFile(caso.origen)).length > 0);
    });
});

test('publicación local: conserva la colección ante una transacción incierta', async () => {
    for (const etapa of ['COMMIT', 'ROLLBACK']) {
        await escenario(async (caso) => {
            const fallo = new ResultadoTransaccionDesconocidoError(
                etapa,
                new Error('Conexión interrumpida'),
            );

            await assert.rejects(
                publicarTeselasLocales(
                    caso.idCapa,
                    caso.generacion,
                    async () => { throw fallo; },
                    caso.raiz,
                ),
                (error) => error === fallo,
            );

            assert.equal((await readdir(caso.carpetaCapa)).length, 1);
        });
    }
});

test('publicación local: rechaza PNG corruptos antes de registrar', async () => {
    await escenario(async (caso) => {
        await writeFile(caso.origen, 'No es PNG');
        let registros = 0;

        await assert.rejects(publicarTeselasLocales(
            caso.idCapa,
            caso.generacion,
            async () => { registros += 1; },
            caso.raiz,
        ));

        assert.equal(registros, 0);
        assert.deepEqual(await readdir(caso.carpetaCapa), []);
    });
});

test('publicación local: rechaza coordenadas duplicadas sin sobrescribir archivos', async () => {
    await escenario(async (caso) => {
        const duplicada = {
            ...caso.generacion,
            total: 2,
            teselas: [
                caso.generacion.teselas[0],
                caso.generacion.teselas[0],
            ],
        };
        let registros = 0;

        await assert.rejects(publicarTeselasLocales(
            caso.idCapa,
            duplicada,
            async () => { registros += 1; },
            caso.raiz,
        ));

        assert.equal(registros, 0);
        assert.deepEqual(await readdir(caso.carpetaCapa), []);
    });
});

test('publicación local: una publicación fallida conserva las versiones anteriores', async () => {
    await escenario(async (caso) => {
        const primera = await publicarTeselasLocales(
            caso.idCapa,
            caso.generacion,
            async (publicacion) => publicacion,
            caso.raiz,
        );

        const fallo = new Error('Segunda publicación revertida');

        await assert.rejects(
            publicarTeselasLocales(
                caso.idCapa,
                caso.generacion,
                async () => { throw fallo; },
                caso.raiz,
            ),
            (error) => error === fallo,
        );

        assert.deepEqual(
            await readdir(caso.carpetaCapa),
            [primera.version],
        );
    });
});