require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');

const {
  mkdtemp,
  mkdir,
  readdir,
  rm,
} = require('node:fs/promises');

const {
  AlmacenamientoLocalService,
} = require(
  '../dist/modules/almacenamiento/almacenamiento-local.service',
);

/**
 * Utiliza una raíz temporal y restaura la variable de entorno al terminar.
 *
 * Las pruebas de este archivo deben ejecutarse secuencialmente,
 * porque la configuración se obtiene desde process.env.
 */
async function conConfiguracionTemporal(operacion) {
  const valorAnterior = process.env.STORAGE_LOCAL_ROOT;
  const temporal = await mkdtemp(
    path.join(tmpdir(), 'ingevit-adaptador-test-'),
  );

  try {
    const raiz = path.join(temporal, 'storage');
    await mkdir(raiz);

    process.env.STORAGE_LOCAL_ROOT = raiz;

    await operacion({ raiz, temporal });
  } finally {
    if (valorAnterior === undefined) {
      delete process.env.STORAGE_LOCAL_ROOT;
    } else {
      process.env.STORAGE_LOCAL_ROOT = valorAnterior;
    }

    await rm(temporal, {
      recursive: true,
      force: true,
    });
  }
}

async function leerContenido(flujo) {
  const fragmentos = [];

  try {
    for await (const fragmento of flujo) {
      fragmentos.push(Buffer.from(fragmento));
    }

    return Buffer.concat(fragmentos);
  } finally {
    flujo.destroy();
  }
}

test(
  'AlmacenamientoLocalService: comportamiento completo',
  { concurrency: false },
  async (t) => {
    await t.test(
      'rechaza operaciones antes de inicializarse',
      async () => {
        const servicio = new AlmacenamientoLocalService();
        const clave = `fotografias/${randomUUID()}.jpg`;
        const entrada = Readable.from([Buffer.from('Contenido.')]);

        const errorEsperado = {
          message: 'El almacenamiento local no está inicializado.',
        };

        try {
          await assert.rejects(
            servicio.guardar(clave, entrada),
            errorEsperado,
          );

          await assert.rejects(
            servicio.abrirLectura(clave),
            errorEsperado,
          );

          await assert.rejects(
            servicio.eliminar(clave),
            errorEsperado,
          );
        } finally {
          entrada.destroy();
        }
      },
    );

    await t.test(
      'inicializa las categorías y permite guardar, leer y eliminar',
      async () => {
        await conConfiguracionTemporal(async ({ raiz }) => {
          const servicio = new AlmacenamientoLocalService();
          await servicio.onModuleInit();

          assert.deepEqual(
            (await readdir(raiz)).sort(),
            ['fotografias', 'panoramicas', 'planos'],
          );

          const clave = `fotografias/${randomUUID()}.jpg`;
          const contenido = Buffer.from([0, 1, 255, 128, 64, 10]);
          const entrada = Readable.from([contenido]);

          try {
            await servicio.guardar(clave, entrada);
          } finally {
            entrada.destroy();
          }

          const flujo = await servicio.abrirLectura(clave);

          assert.deepEqual(
            await leerContenido(flujo),
            contenido,
          );

          await servicio.eliminar(clave);
          await servicio.eliminar(clave);

          await assert.rejects(
            servicio.abrirLectura(clave),
            (error) => {
              assert.equal(error.code, 'ENOENT');
              return true;
            },
          );
        });
      },
    );

    await t.test(
      'no queda disponible cuando falla la inicialización',
      async () => {
        await conConfiguracionTemporal(async ({ temporal }) => {
          process.env.STORAGE_LOCAL_ROOT = path.join(
            temporal,
            'carpeta-inexistente',
          );

          const servicio = new AlmacenamientoLocalService();

          await assert.rejects(
            servicio.onModuleInit(),
            (error) => {
              assert.equal(error.code, 'ENOENT');
              return true;
            },
          );

          await assert.rejects(
            servicio.abrirLectura(
              `fotografias/${randomUUID()}.jpg`,
            ),
            {
              message:
                'El almacenamiento local no está inicializado.',
            },
          );
        });
      },
    );

    await t.test(
      'conserva la raíz inicializada aunque cambie después la variable de entorno',
      async () => {
        await conConfiguracionTemporal(async ({ raiz, temporal }) => {
          const servicio = new AlmacenamientoLocalService();
          await servicio.onModuleInit();

          // El servicio debe conservar su configuración de arranque.
          process.env.STORAGE_LOCAL_ROOT = path.join(
            temporal,
            'otra-ubicacion',
          );

          const nombre = `${randomUUID()}.jpg`;
          const entrada = Readable.from([Buffer.from('Contenido.')]);

          try {
            await servicio.guardar(
              `fotografias/${nombre}`,
              entrada,
            );
          } finally {
            entrada.destroy();
          }

          assert.deepEqual(
            await readdir(path.join(raiz, 'fotografias')),
            [nombre],
          );
        });
      },
    );
  },
);