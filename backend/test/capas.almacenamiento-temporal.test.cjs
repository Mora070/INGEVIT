require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
    mkdtemp,
    readFile,
    readdir,
    rm,
} = require('node:fs/promises');

const {
    AlmacenamientoTemporalCapa,
} = require('../dist/modules/capas/utils/almacenamiento-temporal-capa');

function recibir(almacenamiento, contenido) {
    return new Promise((resolve, reject) => {
        almacenamiento._handleFile(
            {},
            { stream: Readable.from([contenido]) },
            (error, informacion) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(informacion);
            },
        );
    });
}

async function conAlmacenamiento(operacion) {
    const raiz = await mkdtemp(
        join(tmpdir(), 'ingevit-multer-capa-test-'),
    );
    const almacenamiento = new AlmacenamientoTemporalCapa(10, raiz);

    try {
        try {
            await operacion(almacenamiento, raiz);
        } finally {
            await almacenamiento.cerrar();
        }

        assert.deepEqual(await readdir(raiz), []);
    } finally {
        await rm(raiz, { recursive: true, force: true });
    }
}

test('almacenamiento temporal de capa: entrega ruta y tamaño sin cargar un buffer', async () => {
    await conAlmacenamiento(async (almacenamiento) => {
        const contenido = Buffer.from('0123456789');
        const archivo = await recibir(almacenamiento, contenido);

        assert.equal(archivo.size, contenido.length);
        assert.equal(typeof archivo.path, 'string');
        assert.equal(archivo.buffer, undefined);
        assert.deepEqual(await readFile(archivo.path), contenido);

        // La ruta sigue disponible después de que Multer recibe el resultado.
        await new Promise((resolve) => setImmediate(resolve));
        assert.deepEqual(await readFile(archivo.path), contenido);
    });
});

test('almacenamiento temporal de capa: propaga el exceso de tamaño a Multer', async () => {
    await conAlmacenamiento(async (almacenamiento) => {
        await assert.rejects(
            recibir(almacenamiento, Buffer.alloc(11)),
            (error) => {
                assert.equal(error.getStatus(), 413);
                return true;
            },
        );
    });
});

test('almacenamiento temporal de capa: elimina el archivo cuando Multer lo solicita', async () => {
    await conAlmacenamiento(async (almacenamiento, raiz) => {
        const archivo = await recibir(
            almacenamiento,
            Buffer.from('contenido'),
        );

        await new Promise((resolve, reject) => {
            almacenamiento._removeFile({}, archivo, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        assert.deepEqual(await readdir(raiz), []);
    });
});

test('almacenamiento temporal de capa: rechaza un segundo archivo y conserva el primero', async () => {
    await conAlmacenamiento(async (almacenamiento) => {
        const archivo = await recibir(
            almacenamiento,
            Buffer.from('primero'),
        );

        await assert.rejects(
            recibir(almacenamiento, Buffer.from('segundo')),
            /no admite otro archivo/,
        );

        assert.equal(
            (await readFile(archivo.path)).toString(),
            'primero',
        );
    });
});

test('almacenamiento temporal de capa: permite cerrar sin archivo y rechaza reutilización', async () => {
    await conAlmacenamiento(async (almacenamiento, raiz) => {
        await almacenamiento.cerrar();
        await almacenamiento.cerrar();

        await assert.rejects(
            recibir(almacenamiento, Buffer.from('contenido')),
            /no admite otro archivo/,
        );

        assert.deepEqual(await readdir(raiz), []);
    });
});