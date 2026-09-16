require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  inspeccionarPanoramica,
} = require('../dist/modules/panoramicas/utils/inspeccionar-panoramica');

const {
  crearApngDosFotogramas,
} = require('./helpers/crear-apng.cjs');

function imagen(ancho = 400, alto = 200) {
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 30, g: 80, b: 120 },
    },
  });
}

/*
 * Estas imágenes sintéticas comprueban compatibilidad técnica.
 * No representan capturas 360° reales.
 */
for (const [formato, mimeType] of [
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]) {
  test(`PanoramicaInspector: decodifica ${formato} y conserva los bytes`, async () => {
    const contenido = await imagen().toFormat(formato).toBuffer();
    const copia = Buffer.from(contenido);

    assert.deepEqual(await inspeccionarPanoramica(contenido), {
      formato,
      mimeType,
      bytes: contenido.length,
      ancho: 400,
      alto: 200,
      proporcionDosAUno: true,
    });

    assert.deepEqual(contenido, copia);
  });
}

test('PanoramicaInspector: informa una proporción distinta sin certificar contenido 360°', async () => {
  const contenido = await imagen(300, 200).png().toBuffer();
  const resultado = await inspeccionarPanoramica(contenido);

  assert.equal(resultado.proporcionDosAUno, false);
  assert.equal(resultado.ancho, 300);
  assert.equal(resultado.alto, 200);
});

test('PanoramicaInspector: rechaza contenido vacío o ilegible', async () => {
  for (const contenido of [
    Buffer.alloc(0),
    Buffer.from('Esto no es una imagen'),
  ]) {
    await assert.rejects(
      inspeccionarPanoramica(contenido),
      (error) => error.getStatus() === 400,
    );
  }
});

test('PanoramicaInspector: rechaza SVG aunque sea una imagen interpretable', async () => {
  const contenido = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">' +
    '<rect width="400" height="200" fill="blue"/></svg>',
  );

  await assert.rejects(
    inspeccionarPanoramica(contenido),
    (error) => error.getStatus() === 415,
  );
});

test('PanoramicaInspector: aplica el límite también fuera del controlador', async () => {
  await assert.rejects(
    inspeccionarPanoramica(Buffer.alloc(50_000_001)),
    (error) => error.getStatus() === 413,
  );
});

test('PanoramicaInspector: considera la orientación EXIF sin modificar el original', async () => {
  /*
   * El archivo contiene 200 × 400 píxeles.
   * La orientación 6 indica que los ejes se intercambian al mostrarlo.
   */
  const contenido = await imagen(200, 400)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const copia = Buffer.from(contenido);
  const metadatos = await sharp(contenido).metadata();

  assert.equal(metadatos.width, 200);
  assert.equal(metadatos.height, 400);
  assert.equal(metadatos.orientation, 6);

  const resultado = await inspeccionarPanoramica(contenido);

  assert.equal(resultado.ancho, 400);
  assert.equal(resultado.alto, 200);
  assert.equal(resultado.proporcionDosAUno, true);
  assert.deepEqual(contenido, copia);
});

test('PanoramicaInspector: rechaza WebP animado sin modificarlo', async () => {
  const fotogramas = await Promise.all(
    [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
    ].map((background) =>
      sharp({
        create: {
          width: 32,
          height: 16,
          channels: 3,
          background,
        },
      })
        .png()
        .toBuffer(),
    ),
  );

  const contenido = await sharp(fotogramas, {
    join: { animated: true },
  })
    .webp({
      lossless: true,
      loop: 0,
      delay: [100, 100],
    })
    .toBuffer();

  const copia = Buffer.from(contenido);
  const metadatos = await sharp(contenido).metadata();

  // Verifica que la preparación realmente produjo una animación.
  assert.equal(metadatos.format, 'webp');
  assert.equal(metadatos.pages, 2);

  await assert.rejects(
    inspeccionarPanoramica(contenido),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'Solo se aceptan imágenes panorámicas estáticas.',
      );
      return true;
    },
  );

  assert.deepEqual(contenido, copia);
});

test('PanoramicaInspector: rechaza APNG aunque su imagen principal sea legible', async () => {
  const contenido = crearApngDosFotogramas();
  const copia = Buffer.from(contenido);

  // Evita que la prueba pase simplemente por un archivo ilegible.
  const principal = await sharp(contenido)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(principal.info.width, 1);
  assert.equal(principal.info.height, 1);
  assert.deepEqual(
    principal.data,
    Buffer.from([255, 0, 0, 255]),
  );

  await assert.rejects(
    inspeccionarPanoramica(contenido),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'Solo se aceptan imágenes panorámicas estáticas.',
      );
      return true;
    },
  );

  assert.deepEqual(contenido, copia);
});