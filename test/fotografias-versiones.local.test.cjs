require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');

const {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
} = require('node:fs/promises');

const sharp = require('sharp');

const {
  AlmacenamientoLocalService,
} = require(
  '../dist/modules/almacenamiento/almacenamiento-local.service',
);

const {
  FotografiasArchivosService,
} = require(
  '../dist/modules/fotografias/fotografias-archivos.service',
);

const {
  procesarFotografia,
} = require(
  '../dist/modules/fotografias/utils/optimizar-fotografia',
);

const {
  MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
  MAX_LADO_FOTOGRAFIA_OPTIMIZADA,
} = require(
  '../dist/modules/fotografias/config/procesamiento-fotografia.config',
);

test(
  'versiones de fotografía: conserva el original exacto y guarda una versión WebP optimizada',
  async () => {
    const configuracionAnterior = process.env.STORAGE_LOCAL_ROOT;
    const temporal = await mkdtemp(
      path.join(tmpdir(), 'ingevit-versiones-test-'),
    );

    try {
      const raiz = path.join(temporal, 'storage');
      await mkdir(raiz);

      process.env.STORAGE_LOCAL_ROOT = raiz;

      const almacenamiento = new AlmacenamientoLocalService();
      await almacenamiento.onModuleInit();

      const archivos = new FotografiasArchivosService(
        almacenamiento,
      );

      /*
       * Creamos una fotografía de prueba con orientación EXIF.
       * La versión web debe orientarse; el original debe conservarse
       * exactamente como fue recibido.
       */
      const original = await sharp({
        create: {
          width: 3000,
          height: 1500,
          channels: 3,
          background: { r: 30, g: 100, b: 180 },
        },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();

      const copiaOriginal = Buffer.from(original);

      const procesada = await procesarFotografia(original);
      const claves = await archivos.guardarVersiones(procesada);

      assert.notEqual(claves.original_s3_key, claves.s3_key);

      // Las claves ya fueron validadas por el código de almacenamiento.
      const rutaOriginal = path.join(
        raiz,
        ...claves.original_s3_key.split('/'),
      );

      const rutaOptimizada = path.join(
        raiz,
        ...claves.s3_key.split('/'),
      );

      const originalGuardado = await readFile(rutaOriginal);
      const optimizadaGuardada = await readFile(rutaOptimizada);

      // Comparación de bytes: no basta con que ambas imágenes se parezcan.
      assert.deepEqual(originalGuardado, copiaOriginal);
      assert.deepEqual(original, copiaOriginal);
      assert.deepEqual(
        optimizadaGuardada,
        procesada.optimizada,
      );

      const metadatosOriginales =
        await sharp(originalGuardado).metadata();

      assert.equal(metadatosOriginales.format, 'jpeg');
      assert.equal(metadatosOriginales.orientation, 6);
      assert.equal(metadatosOriginales.width, 3000);
      assert.equal(metadatosOriginales.height, 1500);

      const metadatosOptimizados =
        await sharp(optimizadaGuardada).metadata();

      assert.equal(metadatosOptimizados.format, 'webp');
      assert.equal(metadatosOptimizados.pages ?? 1, 1);
      assert.equal(metadatosOptimizados.orientation, undefined);
      assert.equal(metadatosOptimizados.exif, undefined);

      assert.equal(
        metadatosOptimizados.width,
        MAX_LADO_FOTOGRAFIA_OPTIMIZADA / 2,
      );
      assert.equal(
        metadatosOptimizados.height,
        MAX_LADO_FOTOGRAFIA_OPTIMIZADA,
      );

      assert.ok(optimizadaGuardada.length > 0);
      assert.ok(
        optimizadaGuardada.length <= MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
      );

      // Comprueba que el contenido completo de la versión web se decodifique.
      await sharp(optimizadaGuardada).raw().toBuffer();

      // Deben existir exactamente los dos archivos correspondientes.
      const nombresEsperados = [
        path.basename(rutaOriginal),
        path.basename(rutaOptimizada),
      ].sort();

      assert.deepEqual(
        (await readdir(path.join(raiz, 'fotografias'))).sort(),
        nombresEsperados,
      );
    } finally {
      if (configuracionAnterior === undefined) {
        delete process.env.STORAGE_LOCAL_ROOT;
      } else {
        process.env.STORAGE_LOCAL_ROOT = configuracionAnterior;
      }

      await rm(temporal, {
        recursive: true,
        force: true,
      });
    }
  },
);