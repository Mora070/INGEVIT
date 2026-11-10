const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { getRasterioConfig, leerZoomRasterio } = require('../dist/modules/capas/utils/ejecutar-rasterio');

const entorno = {
  CAPAS_PYTHON_PATH: resolve('python'),
  CAPAS_RASTERIO_SCRIPT: resolve('procesar_geotiff.py'),
};
const config = { zoomMin: 12, zoomMax: 19, maxArchivos: 10000 };

test('Rasterio: presupuestos pequeños por defecto y configuración explícita conservada', () => {
  const defaults = getRasterioConfig(entorno);
  assert.equal(defaults.cacheMb, 128);
  assert.equal(defaults.warpMb, 32);
  const explicit = getRasterioConfig({ ...entorno, CAPAS_RASTERIO_CACHE_MB: '192', CAPAS_RASTERIO_WARP_MB: '48' });
  assert.equal(explicit.cacheMb, 192);
  assert.equal(explicit.warpMb, 48);
});

test('Rasterio: rechaza presupuestos no válidos', () => {
  for (const key of ['CAPAS_RASTERIO_CACHE_MB', 'CAPAS_RASTERIO_WARP_MB']) {
    for (const value of ['0', '-1', '1.5', '4097']) {
      assert.throws(() => getRasterioConfig({ ...entorno, [key]: value }));
    }
  }
});

test('Rasterio: telemetría adicional no altera el zoom efectivo', () => {
  const stdout = [
    { evento: 'plan', zoom_min: 12, zoom_max: 18, total: 18, pico_rss_bytes: 100000000 },
    { evento: 'zoom', zoom: 18, overview: 3 },
    { evento: 'memoria', rss_bytes: 90000000 },
    { evento: 'terminado', total: 18, bytes: 123, segundos: 1.2 },
  ].map(JSON.stringify).join('\n');
  assert.equal(leerZoomRasterio(stdout, config), 18);
});

test('Rasterio: no acepta un plan ausente, duplicado o fuera del presupuesto', () => {
  const plan = { evento: 'plan', zoom_min: 12, zoom_max: 19, total: 38 };
  const line = JSON.stringify(plan);
  assert.throws(() => leerZoomRasterio('', config));
  assert.throws(() => leerZoomRasterio(`${line}\n${line}`, config));
  assert.throws(() => leerZoomRasterio(JSON.stringify({ ...plan, total: 10001 }), config));
  assert.throws(() => leerZoomRasterio(JSON.stringify({ ...plan, zoom_max: 20 }), config));
});
