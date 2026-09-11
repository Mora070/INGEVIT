const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');

const {
  mkdtemp,
  mkdir,
  lstat,
  readdir,
  realpath,
  writeFile,
  readFile,
  symlink,
  rm,
} = require('node:fs/promises');

const {
  prepararDirectoriosAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/preparar-directorios-almacenamiento',
);

/**
 * Cada prueba dispone de una carpeta temporal independiente.
 * No utiliza STORAGE_LOCAL_ROOT ni accede al almacenamiento real.
 */
async function conDirectorioTemporal(operacion) {
  const directorio = await mkdtemp(
    path.join(tmpdir(), 'ingevit-directorios-test-'),
  );

  try {
    await operacion(directorio);
  } finally {
    await rm(directorio, {
      recursive: true,
      force: true,
    });
  }
}

test(
  'prepararDirectoriosAlmacenamiento: crea las tres categorías y devuelve la raíz real',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      await mkdir(raiz);

      const resultado =
        await prepararDirectoriosAlmacenamiento(raiz);

      assert.equal(resultado, await realpath(raiz));

      assert.deepEqual(
        (await readdir(raiz)).sort(),
        ['fotografias', 'panoramicas', 'planos'],
      );

      for (const categoria of [
        'fotografias',
        'planos',
        'panoramicas',
      ]) {
        const informacion = await lstat(
          path.join(raiz, categoria),
        );

        assert.equal(informacion.isDirectory(), true);
        assert.equal(informacion.isSymbolicLink(), false);
      }
    });
  },
);

test(
  'prepararDirectoriosAlmacenamiento: permite repetir la inicialización sin modificar archivos',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      await mkdir(raiz);

      await prepararDirectoriosAlmacenamiento(raiz);

      const archivo = path.join(
        raiz,
        'fotografias',
        'contenido-existente.txt',
      );

      await writeFile(archivo, 'Contenido original.', 'utf8');

      const resultado =
        await prepararDirectoriosAlmacenamiento(raiz);

      assert.equal(resultado, await realpath(raiz));
      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido original.',
      );
    });
  },
);

test(
  'prepararDirectoriosAlmacenamiento: rechaza un archivo en lugar de una categoría y lo conserva',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      await mkdir(raiz);

      const archivo = path.join(raiz, 'fotografias');
      await writeFile(archivo, 'No reemplazar.', 'utf8');

      await assert.rejects(
        prepararDirectoriosAlmacenamiento(raiz),
        {
          message:
            'La ubicación de fotografias debe ser un directorio.',
        },
      );

      assert.equal(
        await readFile(archivo, 'utf8'),
        'No reemplazar.',
      );
    });
  },
);

test(
  'prepararDirectoriosAlmacenamiento: rechaza una categoría enlazada fuera de la raíz',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      const destino = path.join(directorio, 'destino-externo');

      await mkdir(raiz);
      await mkdir(destino);

      const archivo = path.join(destino, 'contenido.txt');
      await writeFile(archivo, 'Contenido protegido.', 'utf8');

      await symlink(
        destino,
        path.join(raiz, 'fotografias'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        prepararDirectoriosAlmacenamiento(raiz),
        {
          message:
            'La carpeta fotografias no puede ser un enlace simbólico ni una unión de directorios.',
        },
      );

      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido protegido.',
      );

      assert.deepEqual(await readdir(destino), ['contenido.txt']);
    });
  },
);

test(
  'prepararDirectoriosAlmacenamiento: conserva las carpetas creadas antes de un fallo',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      await mkdir(raiz);

      // Fotografías se crea primero; este archivo hará fallar planos.
      const archivo = path.join(raiz, 'planos');
      await writeFile(archivo, 'Contenido que debe conservarse.', 'utf8');

      await assert.rejects(
        prepararDirectoriosAlmacenamiento(raiz),
        {
          message:
            'La ubicación de planos debe ser un directorio.',
        },
      );

      const fotografias = await lstat(
        path.join(raiz, 'fotografias'),
      );

      assert.equal(fotografias.isDirectory(), true);
      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido que debe conservarse.',
      );

      // La función se detuvo antes de crear panorámicas.
      await assert.rejects(
        lstat(path.join(raiz, 'panoramicas')),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );
    });
  },
);

test(
  'prepararDirectoriosAlmacenamiento: rechaza una raíz inexistente sin crearla',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'no-existe');

      await assert.rejects(
        prepararDirectoriosAlmacenamiento(raiz),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );

      await assert.rejects(
        lstat(raiz),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );
    });
  },
);