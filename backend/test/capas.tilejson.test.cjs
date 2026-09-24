require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    CapasTilejsonService, getCapasApiPublicaUrl,
} = require('../dist/modules/capas/capas-tilejson.service');

test('TileJSON: normaliza la URL configurada y conserva el prefijo', () => {
    assert.equal(getCapasApiPublicaUrl({ CAPAS_API_PUBLICA_URL: 'https://ingevit.example/backend/api/' }),
        'https://ingevit.example/backend/api');
});

test('TileJSON: rechaza URL ausente, protocolos y componentes no permitidos', () => {
    for (const valor of [undefined, '', '/api', 'ftp://example.com', 'https://a:b@example.com/api',
        'https://example.com/api?token=x', 'https://example.com/api#x', ' https://example.com']) {
        assert.throws(() => getCapasApiPublicaUrl({ CAPAS_API_PUBLICA_URL: valor }));
    }
});

const fila = {
    id_capa: 'capa', teselas_version: 'version', nombre: 'Ortofoto',
    teselas_zoom_min: 12, teselas_zoom_max: 22,
    bbox_oeste: '-74.22', bbox_sur: '4.62', bbox_este: '-74.21', bbox_norte: '4.63',
    original_key: 'dato-interno', procesamiento_token: 'secreto-interno',
};

test('TileJSON: devuelve únicamente el descriptor público y autoriza la consulta', async () => {
    const anterior = process.env.CAPAS_API_PUBLICA_URL;
    process.env.CAPAS_API_PUBLICA_URL = 'http://127.0.0.1:3000/api';
    try {
        const consultas = [];
        const servicio = new CapasTilejsonService({ buscarDisponible: async (...args) => {
            consultas.push(args); return fila;
        } });
        assert.deepEqual(await servicio.obtener('proyecto', 'capa', 'version', 'usuario'), {
            tilejson: '3.0.0', name: 'Ortofoto', scheme: 'xyz',
            tiles: ['http://127.0.0.1:3000/api/proyectos/proyecto/capas/capa/teselas/version/{z}/{x}/{y}.png'],
            minzoom: 12, maxzoom: 22, bounds: [-74.22, 4.62, -74.21, 4.63],
        });
        assert.deepEqual(consultas, [['proyecto', 'capa', 'version', 'usuario']]);
    } finally {
        if (anterior === undefined) delete process.env.CAPAS_API_PUBLICA_URL;
        else process.env.CAPAS_API_PUBLICA_URL = anterior;
    }
});

test('TileJSON: oculta una publicación no autorizada', async () => {
    const servicio = new CapasTilejsonService({ buscarDisponible: async () => null });
    await assert.rejects(servicio.obtener('p', 'c', 'v', 'u'), e => e.getStatus() === 404);
});

test('TileJSON: rechaza coordenadas nulas o fuera de rango', async () => {
    for (const cambios of [{ bbox_oeste: null }, { bbox_sur: '' }, { bbox_este: 'NaN' },
        { bbox_norte: '91' }, { bbox_oeste: '1' }]) {
        const servicio = new CapasTilejsonService({ buscarDisponible: async () => ({ ...fila, ...cambios }) });
        await assert.rejects(servicio.obtener('p', 'c', 'v', 'u'), /extensión|rango/);
    }
});

test('TileJSON: rechaza niveles de zoom inconsistentes', async () => {
    const servicio = new CapasTilejsonService({
        buscarDisponible: async () => ({ ...fila, teselas_zoom_min: 23 }),
    });
    await assert.rejects(servicio.obtener('p', 'c', 'v', 'u'), /niveles/);
});
