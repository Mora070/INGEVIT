require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CapasTeselasService } = require('../dist/modules/capas/capas-teselas.service');

function escenario(disponible = { id_capa: 'capa-bd', teselas_version: 'version-bd', teselas_zoom_min: 12, teselas_zoom_max: 22 }) {
    const consultas = [];
    const lecturas = [];
    const contenido = Buffer.from('tesela');
    const servicio = new CapasTeselasService({
        buscarDisponible: async (...args) => { consultas.push(args); return disponible; },
    }, {
        leer: async (...args) => { lecturas.push(args); return contenido; },
    });
    const obtener = (z = '22', x = '100', archivo = '200.png') =>
        servicio.obtener('proyecto', 'capa', 'version', 'usuario', z, x, archivo);
    return { servicio, obtener, consultas, lecturas, contenido };
}

test('teselas: autoriza y lee usando las claves de la fila consultada', async () => {
    const e = escenario();
    assert.equal(await e.obtener(), e.contenido);
    assert.deepEqual(e.consultas, [['proyecto', 'capa', 'version', 'usuario']]);
    assert.deepEqual(e.lecturas, [['capa-bd', 'version-bd', 22, 100, 200]]);
});

test('teselas: sin publicación autorizada no accede a archivos', async () => {
    const e = escenario(null);
    await assert.rejects(e.obtener(), error => error.getStatus() === 404);
    assert.deepEqual(e.lecturas, []);
});

test('teselas: rechaza niveles no publicados', async () => {
    const e = escenario();
    for (const z of ['11', '23']) {
        await assert.rejects(e.obtener(z), error => error.getStatus() === 404);
    }
    assert.deepEqual(e.lecturas, []);
});

test('teselas: rechaza nombres y coordenadas no canónicos antes de consultar', async () => {
    const e = escenario();
    for (const args of [
        ['22', '100', '../200.png'], ['22', '100', '200.jpg'],
        ['22', '100', '0200.png'], ['22', '-1', '200.png'],
        ['2e1', '100', '200.png'], ['22', ' 100', '200.png'],
    ]) {
        await assert.rejects(e.obtener(...args), error => error.getStatus() === 400);
    }
    assert.deepEqual(e.consultas, []);
    assert.deepEqual(e.lecturas, []);
});

test('teselas: rechaza coordenadas fuera de la cuadrícula mundial', async () => {
    const e = escenario();
    for (const args of [['31', '0', '0.png'], ['12', '4096', '0.png'], ['12', '0', '4096.png']]) {
        await assert.rejects(e.obtener(...args), error => error.getStatus() === 400);
    }
    assert.deepEqual(e.consultas, []);
});

const { mkdtemp, mkdir, writeFile, symlink, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const sharp = require('sharp');
const { TeselasLocalesService } = require('../dist/modules/capas/teselas-locales.service');
const id = '20000000-0000-4000-8000-000000000001';
const version = '20000000-0000-4000-8000-000000000002';

async function conArchivos(operacion) {
    const raiz = await mkdtemp(join(tmpdir(), 'ingevit-lectura-teselas-'));
    const anterior = process.env.STORAGE_LOCAL_ROOT;
    process.env.STORAGE_LOCAL_ROOT = raiz;
    try {
        await operacion(raiz, new TeselasLocalesService());
    } finally {
        if (anterior === undefined) delete process.env.STORAGE_LOCAL_ROOT;
        else process.env.STORAGE_LOCAL_ROOT = anterior;
        await rm(raiz, { recursive: true, force: true });
    }
}

test('teselas locales: entrega un PNG existente sin modificar sus bytes', async () => {
    await conArchivos(async (raiz, servicio) => {
        const carpeta = join(raiz, 'capas-teselas', id, version, 'tiles', '22', '100');
        await mkdir(carpeta, { recursive: true });
        const png = await sharp({ create: {
            width: 256, height: 256, channels: 4,
            background: { r: 10, g: 20, b: 30, alpha: 1 },
        } }).png().toBuffer();
        await writeFile(join(carpeta, '200.png'), png);
        assert.deepEqual(await servicio.leer(id, version, 22, 100, 200), png);
    });
});

test('teselas locales: archivo ausente o de tamaño excesivo devuelve 404', async () => {
    await conArchivos(async (raiz, servicio) => {
        await assert.rejects(servicio.leer(id, version, 22, 100, 200), e => e.getStatus() === 404);
        const carpeta = join(raiz, 'capas-teselas', id, version, 'tiles', '22', '100');
        await mkdir(carpeta, { recursive: true });
        await writeFile(join(carpeta, '200.png'), Buffer.alloc(1024 * 1024 + 1));
        await assert.rejects(servicio.leer(id, version, 22, 100, 200), e => e.getStatus() === 404);
    });
});

test('teselas locales: rechaza una categoría redirigida mediante enlace', async () => {
    await conArchivos(async (raiz, servicio) => {
        const destino = join(raiz, 'otro-directorio');
        await mkdir(destino);
        await symlink(destino, join(raiz, 'capas-teselas'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(servicio.leer(id, version, 22, 100, 200), e => e.getStatus() === 404);
    });
});
