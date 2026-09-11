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
  lstat,
  readdir,
  symlink,
  rmdir,
  rm,
} = require('node:fs/promises');

const {
  eliminarArchivoLocal,
} = require(
  '../dist/modules/almacenamiento/utils/eliminar-archivo-local',
);

const {
  prepararDirectoriosAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/preparar-directorios-almacenamiento',
);

/**
 * Cada prueba utiliza su propio almacenamiento temporal.
 * No utiliza la configuración ni los archivos reales del backend.
 */
async function conAlmacenamientoTemporal(operacion) {
  const temporal = await mkdtemp(
    path.join(tmpdir(), 'ingevit-eliminacion-test-'),
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

test(
  'eliminarArchivoLocal: elimina únicamente el archivo indicado',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const otroNombre = `${randomUUID()}.jpg`;
      const categoria = path.join(raiz, 'fotografias');
      const ruta = path.join(categoria, nombre);
      const otraRuta = path.join(categoria, otroNombre);

      await writeFile(ruta, 'Archivo que se eliminará.', 'utf8');
      await writeFile(otraRuta, 'Archivo que debe conservarse.', 'utf8');

      await eliminarArchivoLocal(
        raiz,
        `fotografias/${nombre}`,
      );

      await assert.rejects(
        lstat(ruta),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );

      assert.equal(
        await readFile(otraRuta, 'utf8'),
        'Archivo que debe conservarse.',
      );
      assert.deepEqual(await readdir(categoria), [otroNombre]);
    });
  },
);

test(
  'eliminarArchivoLocal: permite repetir la eliminación de la misma clave',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;

      await writeFile(
        path.join(raiz, 'fotografias', nombre),
        'Contenido temporal.',
        'utf8',
      );

      await eliminarArchivoLocal(raiz, `fotografias/${nombre}`);
      await eliminarArchivoLocal(raiz, `fotografias/${nombre}`);

      assert.deepEqual(
        await readdir(path.join(raiz, 'fotografias')),
        [],
      );
    });
  },
);

test(
  'eliminarArchivoLocal: termina correctamente si el archivo nunca existió',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      await eliminarArchivoLocal(
        raiz,
        `fotografias/${randomUUID()}.jpg`,
      );

      assert.deepEqual(
        await readdir(path.join(raiz, 'fotografias')),
        [],
      );
    });
  },
);

test(
  'eliminarArchivoLocal: rechaza una clave inválida y conserva los archivos',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const categoria = path.join(raiz, 'fotografias');
      const nombre = `${randomUUID()}.jpg`;

      await writeFile(
        path.join(categoria, nombre),
        'Contenido original.',
        'utf8',
      );

      await assert.rejects(
        eliminarArchivoLocal(
          raiz,
          'fotografias/../../archivo.jpg',
        ),
        {
          message:
            'La clave de almacenamiento tiene un formato no permitido.',
        },
      );

      assert.equal(
        await readFile(path.join(categoria, nombre), 'utf8'),
        'Contenido original.',
      );
    });
  },
);

test(
  'eliminarArchivoLocal: rechaza un directorio con nombre de archivo',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const directorio = path.join(raiz, 'fotografias', nombre);

      await mkdir(directorio);
      await writeFile(
        path.join(directorio, 'contenido.txt'),
        'No eliminar.',
        'utf8',
      );

      await assert.rejects(
        eliminarArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'La clave de almacenamiento debe identificar un archivo regular.',
        },
      );

      assert.equal(
        await readFile(
          path.join(directorio, 'contenido.txt'),
          'utf8',
        ),
        'No eliminar.',
      );
    });
  },
);

test(
  'eliminarArchivoLocal: rechaza una categoría enlazada y conserva el destino',
  async () => {
    await conAlmacenamientoTemporal(async ({ temporal, raiz }) => {
      const categoria = path.join(raiz, 'fotografias');
      const destino = path.join(temporal, 'destino-externo');
      const nombre = `${randomUUID()}.jpg`;

      await mkdir(destino);
      await writeFile(
        path.join(destino, nombre),
        'Contenido del destino.',
        'utf8',
      );

      await rmdir(categoria);

      await symlink(
        destino,
        categoria,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        eliminarArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'La carpeta de destino no puede ser un enlace simbólico ni una unión de directorios.',
        },
      );

      assert.equal(
        await readFile(path.join(destino, nombre), 'utf8'),
        'Contenido del destino.',
      );
    });
  },
);

test(
  'eliminarArchivoLocal: rechaza un enlace en la ubicación final sin eliminarlo',
  async () => {
    await conAlmacenamientoTemporal(async ({ temporal, raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const enlace = path.join(raiz, 'fotografias', nombre);
      const destino = path.join(temporal, 'destino-enlace-final');

      await mkdir(destino);
      await writeFile(
        path.join(destino, 'contenido.txt'),
        'Contenido protegido.',
        'utf8',
      );

      // En Windows utilizamos una unión a directorio.
      await symlink(
        destino,
        enlace,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        eliminarArchivoLocal(raiz, `fotografias/${nombre}`),
        {
          message:
            'El archivo de almacenamiento no puede ser un enlace simbólico.',
        },
      );

      assert.equal((await lstat(enlace)).isSymbolicLink(), true);
      assert.equal(
        await readFile(path.join(destino, 'contenido.txt'), 'utf8'),
        'Contenido protegido.',
      );
    });
  },
);

test(
  'eliminarArchivoLocal: no oculta la ausencia de la carpeta de categoría',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      await rmdir(path.join(raiz, 'fotografias'));

      await assert.rejects(
        eliminarArchivoLocal(
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