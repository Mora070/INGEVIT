const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} = require('@nestjs/common');

const {
  optimizarAvatar,
} = require('../dist/modules/usuarios/utils/optimizar-avatar');

const {
  MAX_BYTES_AVATAR_ENTRADA,
} = require('../dist/modules/usuarios/config/avatar.config');

async function crearImagen(ancho, alto, formato = 'png') {
  return sharp({
    create: {
      width: ancho,
      height: alto,
      channels: 3,
      background: { r: 30, g: 120, b: 180 },
    },
  })
    .toFormat(formato)
    .toBuffer();
}

test('avatar: convierte JPEG, PNG y WebP a WebP sin modificar la entrada', async () => {
  for (const formato of ['jpeg', 'png', 'webp']) {
    const entrada = await crearImagen(300, 200, formato);
    const copia = Buffer.from(entrada);

    const resultado = await optimizarAvatar(entrada);
    const metadatos = await sharp(resultado).metadata();

    assert.ok(Buffer.isBuffer(resultado));
    assert.equal(metadatos.format, 'webp');
    assert.equal(metadatos.width, 300);
    assert.equal(metadatos.height, 200);
    assert.deepEqual(entrada, copia);
  }
});

test('avatar: limita ambas dimensiones conservando la proporción', async () => {
  for (const [ancho, alto, esperadoAncho, esperadoAlto] of [
    [1600, 800, 512, 256],
    [800, 1600, 256, 512],
    [1200, 1200, 512, 512],
  ]) {
    const entrada = await crearImagen(ancho, alto);
    const resultado = await optimizarAvatar(entrada);
    const metadatos = await sharp(resultado).metadata();

    assert.equal(metadatos.width, esperadoAncho);
    assert.equal(metadatos.height, esperadoAlto);
  }
});

test('avatar: no amplía imágenes pequeñas', async () => {
  const entrada = await crearImagen(80, 120);
  const resultado = await optimizarAvatar(entrada);
  const metadatos = await sharp(resultado).metadata();

  assert.equal(metadatos.width, 80);
  assert.equal(metadatos.height, 120);
});

test('avatar: aplica la orientación EXIF y elimina esos metadatos', async () => {
  const entrada = await sharp({
    create: {
      width: 800,
      height: 400,
      channels: 3,
      background: { r: 100, g: 50, b: 20 },
    },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const resultado = await optimizarAvatar(entrada);
  const metadatos = await sharp(resultado).metadata();

  assert.equal(metadatos.format, 'webp');
  assert.equal(metadatos.width, 256);
  assert.equal(metadatos.height, 512);
  assert.equal(metadatos.orientation, undefined);
  assert.equal(metadatos.exif, undefined);
});

test('avatar: rechaza entradas vacías, contenido inválido y SVG', async () => {
  for (const entrada of [
    undefined,
    Buffer.alloc(0),
    Buffer.from('Esto no es una imagen'),
  ]) {
    await assert.rejects(
      () => optimizarAvatar(entrada),
      BadRequestException,
    );
  }

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">' +
    '<rect width="20" height="20" fill="red"/></svg>',
  );

  await assert.rejects(
    () => optimizarAvatar(svg),
    UnsupportedMediaTypeException,
  );
});

test('avatar: rechaza archivos que superan 5 MiB antes de procesarlos', async () => {
  const entrada = Buffer.alloc(MAX_BYTES_AVATAR_ENTRADA + 1);

  await assert.rejects(
    () => optimizarAvatar(entrada),
    PayloadTooLargeException,
  );
});