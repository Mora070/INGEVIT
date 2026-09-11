require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  inspeccionarFotografia,
} = require(
  '../dist/modules/fotografias/utils/inspeccionar-fotografia',
);

const {
  MAX_BYTES_FOTOGRAFIA_ORIGINAL,
} = require(
  '../dist/modules/fotografias/config/procesamiento-fotografia.config',
);

/**
 * Genera imágenes pequeñas en memoria.
 * No descarga recursos ni utiliza fotografías personales.
 */
async function crearImagen(formato) {
  return sharp({
    create: {
      width: 16,
      height: 12,
      channels: 3,
      background: { r: 30, g: 100, b: 180 },
    },
  })
    .toFormat(formato)
    .toBuffer();
}

for (const formato of ['jpeg', 'png', 'webp']) {
  test(
    `inspeccionarFotografia: acepta ${formato} estático sin modificar el original`,
    async () => {
      const contenido = await crearImagen(formato);
      const copiaOriginal = Buffer.from(contenido);

      const resultado = await inspeccionarFotografia(contenido);

      assert.deepEqual(resultado, {
        formato,
        bytes: contenido.length,
        ancho: 16,
        alto: 12,
        fotogramas: 1,
      });

      assert.deepEqual(contenido, copiaOriginal);
    },
  );
}

test(
  'inspeccionarFotografia: rechaza un archivo vacío',
  async () => {
    await assert.rejects(
      inspeccionarFotografia(Buffer.alloc(0)),
      (error) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'Debes proporcionar un archivo de fotografía no vacío.',
        );
        return true;
      },
    );
  },
);

test(
  'inspeccionarFotografia: rechaza contenido que no sea un Buffer',
  async () => {
    await assert.rejects(
      inspeccionarFotografia('fotografia.jpg'),
      (error) => {
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );
  },
);

test(
  'inspeccionarFotografia: rechaza un archivo superior a 20 MiB',
  async () => {
    const contenido = Buffer.alloc(
      MAX_BYTES_FOTOGRAFIA_ORIGINAL + 1,
    );

    await assert.rejects(
      inspeccionarFotografia(contenido),
      (error) => {
        assert.equal(error.getStatus(), 413);
        assert.equal(
          error.message,
          'La fotografía no puede superar 20 MiB.',
        );
        return true;
      },
    );
  },
);

test(
  'inspeccionarFotografia: rechaza contenido que no puede interpretarse como imagen',
  async () => {
    await assert.rejects(
      inspeccionarFotografia(Buffer.from('Esto no es una imagen.')),
      (error) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'No se pudo interpretar la fotografía recibida.',
        );
        return true;
      },
    );
  },
);

test(
  'inspeccionarFotografia: rechaza un formato no permitido aunque Sharp pueda interpretarlo',
  async () => {
    const contenido = await crearImagen('tiff');

    await assert.rejects(
      inspeccionarFotografia(contenido),
      (error) => {
        assert.equal(error.getStatus(), 415);
        assert.equal(
          error.message,
          'Solo se permiten fotografías JPG, JPEG, PNG y WebP.',
        );
        return true;
      },
    );
  },
);

test(
  'inspeccionarFotografia: rechaza un WebP animado sin modificar sus bytes',
  async () => {
    /**
     * Generamos dos fotogramas distintos para evitar que el codificador
     * pueda combinarlos en una única imagen estática.
     */
    const fotogramas = await Promise.all(
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ].map((background) =>
        sharp({
          create: {
            width: 16,
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

    const copiaOriginal = Buffer.from(contenido);

    // Comprobamos la preparación antes de probar nuestro código.
    const metadatos = await sharp(contenido).metadata();

    assert.equal(metadatos.format, 'webp');
    assert.equal(metadatos.pages, 2);

    await assert.rejects(
      inspeccionarFotografia(contenido),
      (error) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'Solo se aceptan fotografías estáticas.',
        );

        return true;
      },
    );

    assert.deepEqual(contenido, copiaOriginal);
  },
);