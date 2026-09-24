require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
    mkdtemp,
    readdir,
    readFile,
    rm,
} = require('node:fs/promises');

const {
    recibirTemporalCapa,
} = require('../dist/modules/capas/utils/recibir-temporal-capa');

/**
 * Cada prueba usa una raíz exclusiva.
 * Comprobamos que no quedan archivos después de cada operación.
 */
async function conRaizTemporal(operacion) {
    const raiz = await mkdtemp(
        join(tmpdir(), 'ingevit-capa-test-'),
    );

    try {
        await operacion(raiz);
        assert.deepEqual(await readdir(raiz), []);
    } finally {
        await rm(raiz, { recursive: true, force: true });
    }
}

test('temporal de capa: conserva los bytes y acepta exactamente el límite', async () => {
    await conRaizTemporal(async (raiz) => {
        const original = Buffer.from([0, 1, 2, 3, 254, 255]);

        const resultado = await recibirTemporalCapa(
            Readable.from([
                original.subarray(0, 2),
                original.subarray(2),
            ]),
            original.length,
            async ({ ruta, tamanoBytes }) => {
                assert.equal(tamanoBytes, original.length);
                assert.deepEqual(await readFile(ruta), original);
                return 'procesado';
            },
            raiz,
        );

        assert.equal(resultado, 'procesado');
    });
});

test('temporal de capa: rechaza el primer byte excedente y limpia el parcial', async () => {
    await conRaizTemporal(async (raiz) => {
        let invocaciones = 0;

        await assert.rejects(
            recibirTemporalCapa(
                Readable.from([
                    Buffer.alloc(4),
                    Buffer.alloc(3),
                ]),
                6,
                async () => {
                    invocaciones += 1;
                },
                raiz,
            ),
            (error) => {
                assert.equal(error.getStatus(), 413);
                return true;
            },
        );

        assert.equal(invocaciones, 0);
    });
});

test('temporal de capa: rechaza archivos vacíos sin procesarlos', async () => {
    await conRaizTemporal(async (raiz) => {
        let invocaciones = 0;

        await assert.rejects(
            recibirTemporalCapa(
                Readable.from([]),
                10,
                async () => {
                    invocaciones += 1;
                },
                raiz,
            ),
            (error) => {
                assert.equal(error.getStatus(), 400);
                return true;
            },
        );

        assert.equal(invocaciones, 0);
    });
});

test('temporal de capa: propaga el fallo de recepción y limpia el archivo', async () => {
    await conRaizTemporal(async (raiz) => {
        const fallo = new Error('Recepción interrumpida');
        let invocaciones = 0;

        async function* fragmentos() {
            yield Buffer.from('inicio');
            throw fallo;
        }

        await assert.rejects(
            recibirTemporalCapa(
                Readable.from(fragmentos()),
                100,
                async () => {
                    invocaciones += 1;
                },
                raiz,
            ),
            (error) => error === fallo,
        );

        assert.equal(invocaciones, 0);
    });
});

test('temporal de capa: limpia el archivo si falla su procesamiento', async () => {
    await conRaizTemporal(async (raiz) => {
        const fallo = new Error('GeoTIFF no válido');

        await assert.rejects(
            recibirTemporalCapa(
                Readable.from([Buffer.from('contenido')]),
                100,
                async ({ ruta }) => {
                    assert.equal(
                        (await readFile(ruta)).toString(),
                        'contenido',
                    );
                    throw fallo;
                },
                raiz,
            ),
            (error) => error === fallo,
        );
    });
});

test('temporal de capa: rechaza límites inválidos antes de crear archivos', async () => {
    await conRaizTemporal(async (raiz) => {
        for (const limite of [
            0,
            -1,
            1.5,
            NaN,
            Infinity,
            Number.MAX_SAFE_INTEGER,
        ]) {
            const contenido = Readable.from([]);

            try {
                await assert.rejects(
                    recibirTemporalCapa(
                        contenido,
                        limite,
                        async () => {},
                        raiz,
                    ),
                    /límite temporal/,
                );
            } finally {
                contenido.destroy();
            }
        }
    });
});