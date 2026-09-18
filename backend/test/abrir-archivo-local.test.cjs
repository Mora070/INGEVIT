const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');

const {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rmdir,
  rm,
} = require('node:fs/promises');

const {
  abrirArchivoLocal,
} = require(
  '../dist/modules/almacenamiento/utils/abrir-archivo-local',
);

const {
  prepararDirectoriosAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/preparar-directorios-almacenamiento',
);

/**
 * Prepara una raíz temporal independiente para cada prueba.
 * No utiliza la configuración ni los archivos reales del backend.
 */
async function conAlmacenamientoTemporal(operacion) {
  const temporal = await mkdtemp(
    path.join(tmpdir(), 'ingevit-lectura-test-'),
  );

  try {
    const raiz = path.join(temporal, 'storage');
    await mkdir(raiz);
    await prepararDirectoriosAlmacenamiento(raiz);

    await operacion({ temporal, raiz });
  } finally {
    await rm(temporal, {
      recursive: true,
      force: true,
    });
  }
}

/**
 * Consume el flujo para comparar su contenido.
 * La acumulación en memoria pertenece únicamente a estas pruebas pequeñas.
 */
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
  'abrirArchivoLocal: devuelve el contenido binario sin modificar el archivo',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const ruta = path.join(raiz, 'fotografias', nombre);
      const contenido = Buffer.from([0, 1, 255, 128, 64, 10]);

      await writeFile(ruta, contenido);

      const flujo = await abrirArchivoLocal(
        raiz,
        `fotografias/${nombre}`,
      );

      assert.deepEqual(await leerContenido(flujo), contenido);
      assert.deepEqual(await readFile(ruta), contenido);
    });
  },
);

test(
  'abrirArchivoLocal: permite leer un archivo vacío',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;

      await writeFile(
        path.join(raiz, 'fotografias', nombre),
        Buffer.alloc(0),
      );

      const flujo = await abrirArchivoLocal(
        raiz,
        `fotografias/${nombre}`,
      );

      assert.deepEqual(
        await leerContenido(flujo),
        Buffer.alloc(0),
      );
    });
  },
);

test(
  'abrirArchivoLocal: propaga ENOENT cuando el archivo no existe',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      await assert.rejects(
        abrirArchivoLocal(
          raiz,
          `fotografias/${randomUUID()}.jpg`,
        ),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );
    });
  },
);

test(
  'abrirArchivoLocal: rechaza una clave con segmentos ascendentes',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      await assert.rejects(
        abrirArchivoLocal(
          raiz,
          'fotografias/../../archivo.jpg',
        ),
        {
          message:
            'La clave de almacenamiento tiene un formato no permitido.',
        },
      );
    });
  },
);

test(
  'abrirArchivoLocal: rechaza un directorio con nombre de archivo',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;

      await mkdir(path.join(raiz, 'fotografias', nombre));

      await assert.rejects(
        abrirArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'La clave de almacenamiento debe identificar un archivo regular.',
        },
      );
    });
  },
);

test(
  'abrirArchivoLocal: rechaza una categoría sustituida por un enlace o unión',
  async () => {
    await conAlmacenamientoTemporal(async ({ temporal, raiz }) => {
      const categoria = path.join(raiz, 'fotografias');
      const destino = path.join(temporal, 'destino-externo');
      const nombre = `${randomUUID()}.jpg`;
      const contenido = Buffer.from('Contenido fuera de la raíz.');

      await mkdir(destino);
      await writeFile(path.join(destino, nombre), contenido);

      // Solo se retira la categoría vacía creada por esta prueba.
      await rmdir(categoria);

      await symlink(
        destino,
        categoria,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        abrirArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'La carpeta de origen no puede ser un enlace simbólico ni una unión de directorios.',
        },
      );

      assert.deepEqual(
        await readFile(path.join(destino, nombre)),
        contenido,
      );
    });
  },
);

test(
  'abrirArchivoLocal: rechaza un enlace en la ubicación final del archivo',
  async () => {
    await conAlmacenamientoTemporal(async ({ temporal, raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const destino = path.join(temporal, 'destino-enlace-final');

      await mkdir(destino);

      /*
       * En Windows usamos una unión a un directorio para comprobar
       * el rechazo de un enlace final sin exigir permisos especiales
       * para crear enlaces simbólicos a archivos.
       */
      await symlink(
        destino,
        path.join(raiz, 'fotografias', nombre),
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        abrirArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'El archivo de almacenamiento no puede ser un enlace simbólico.',
        },
      );
    });
  },
);