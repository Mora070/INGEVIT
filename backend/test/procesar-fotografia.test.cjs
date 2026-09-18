require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  procesarFotografia,
} = require(
  '../dist/modules/fotografias/utils/optimizar-fotografia',
);

const {
  MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
} = require(
  '../dist/modules/fotografias/config/procesamiento-fotografia.config',
);

/**
 * Genera originales pequeños en memoria.
 * No utiliza archivos personales ni escribe en el almacenamiento.
 */
async function crearOriginal(formato) {
  return sharp({
    create: {
      width: 80,
      height: 40,
      channels: 3,
      background: { r: 30, g: 100, b: 180 },
    },
  })
    .toFormat(formato)
    .toBuffer();
}

for (const formato of ['jpeg', 'png', 'webp']) {
  test(
    `procesarFotografia: devuelve ambas versiones desde ${formato} y conserva el original`,
    async () => {
      const original = await crearOriginal(formato);
      const copiaOriginal = Buffer.from(original);

      const resultado = await procesarFotografia(original);

      assert.deepEqual(
        Object.keys(resultado).sort(),
        ['formatoOriginal', 'optimizada', 'original'],
      );

      assert.equal(resultado.formatoOriginal, formato);

      // El contrato conserva el mismo Buffer, sin recodificar el original.
      assert.strictEqual(resultado.original, original);
      assert.deepEqual(resultado.original, copiaOriginal);

      assert.ok(Buffer.isBuffer(resultado.optimizada));
      assert.notStrictEqual(resultado.optimizada, original);
      assert.ok(resultado.optimizada.length > 0);
      assert.ok(
        resultado.optimizada.length <= MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
      );

      const metadatos = await sharp(resultado.optimizada).metadata();

      assert.equal(metadatos.format, 'webp');
      assert.equal(metadatos.pages ?? 1, 1);
      assert.equal(metadatos.width, 80);
      assert.equal(metadatos.height, 40);
    },
  );
}

test(
  'procesarFotografia: conserva los metadatos del original y orienta únicamente la versión web',
  async () => {
    const original = await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 3,
        background: { r: 30, g: 100, b: 180 },
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const copiaOriginal = Buffer.from(original);

    const resultado = await procesarFotografia(original);

    assert.deepEqual(resultado.original, copiaOriginal);

    const metadatosOriginales =
      await sharp(resultado.original).metadata();

    const metadatosOptimizados =
      await sharp(resultado.optimizada).metadata();

    assert.equal(metadatosOriginales.orientation, 6);
    assert.equal(metadatosOriginales.width, 80);
    assert.equal(metadatosOriginales.height, 40);

    assert.equal(metadatosOptimizados.orientation, undefined);
    assert.equal(metadatosOptimizados.exif, undefined);
    assert.equal(metadatosOptimizados.width, 40);
    assert.equal(metadatosOptimizados.height, 80);
  },
);