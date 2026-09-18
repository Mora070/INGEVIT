require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_BYTES_PANORAMICA,
  getSubidaPanoramicaConfig,
} = require('../dist/modules/panoramicas/config/subida-panoramica.config');

const {
  ContenidoPanoramicaPipe,
} = require('../dist/modules/panoramicas/pipes/contenido-panoramica.pipe');

test('Panoramicas recepción: configura un archivo y el límite inclusivo', () => {
  assert.equal(MAX_BYTES_PANORAMICA, 50_000_000);
  assert.deepEqual(getSubidaPanoramicaConfig().limits, {
    files: 1,
    fileSize: 50_000_001,
  });
});

test('Panoramicas recepción: rechaza archivos ausentes o vacíos', () => {
  const pipe = new ContenidoPanoramicaPipe();

  for (const archivo of [
    undefined,
    {},
    { buffer: Buffer.alloc(0) },
    { buffer: 'no es un Buffer' },
  ]) {
    assert.throws(
      () => pipe.transform(archivo),
      (error) => {
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  }
});

test('Panoramicas recepción: admite exactamente 50 MB sin copiar el Buffer', () => {
  const pipe = new ContenidoPanoramicaPipe();
  const contenido = Buffer.alloc(MAX_BYTES_PANORAMICA);

  assert.strictEqual(
    pipe.transform({ buffer: contenido }),
    contenido,
  );
});

test('Panoramicas recepción: rechaza un byte adicional aunque el tamaño declarado sea menor', () => {
  const pipe = new ContenidoPanoramicaPipe();

  assert.throws(
    () => pipe.transform({
      buffer: Buffer.alloc(MAX_BYTES_PANORAMICA + 1),
      size: 1,
    }),
    (error) => {
      assert.equal(error.getStatus(), 413);
      assert.equal(error.message, 'La panorámica no puede superar 50 MB.');
      return true;
    },
  );
});