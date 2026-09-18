const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');

const {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
  symlink,
  rm,
} = require('node:fs/promises');

const {
  prepararRaizAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/preparar-raiz-almacenamiento',
);

/**
 * Crea un directorio temporal exclusivo para cada prueba.
 *
 * La limpieza se limita al directorio generado por mkdtemp.
 * No utiliza la configuración del backend ni su almacenamiento real.
 */
async function conDirectorioTemporal(operacion) {
  const directorio = await mkdtemp(
    path.join(tmpdir(), 'ingevit-raiz-test-'),
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
  'prepararRaizAlmacenamiento: devuelve la ubicación real y conserva los archivos existentes',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'storage');
      await mkdir(raiz);

      const archivo = path.join(raiz, 'contenido-existente.txt');
      await writeFile(archivo, 'Contenido que debe conservarse.', 'utf8');

      const resultado = await prepararRaizAlmacenamiento(raiz);

      assert.equal(resultado, await realpath(raiz));
      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido que debe conservarse.',
      );
    });
  },
);

test(
  'prepararRaizAlmacenamiento: rechaza una carpeta inexistente sin crearla',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const raiz = path.join(directorio, 'no-existe');

      await assert.rejects(
        prepararRaizAlmacenamiento(raiz),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );

      // Confirma que la función no creó la carpeta.
      await assert.rejects(
        realpath(raiz),
        (error) => {
          assert.equal(error.code, 'ENOENT');
          return true;
        },
      );
    });
  },
);

test(
  'prepararRaizAlmacenamiento: rechaza un archivo utilizado como raíz',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const archivo = path.join(directorio, 'archivo.txt');
      await writeFile(archivo, 'Contenido original.', 'utf8');

      await assert.rejects(
        prepararRaizAlmacenamiento(archivo),
        {
          message:
            'La raíz de almacenamiento debe ser un directorio.',
        },
      );

      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido original.',
      );
    });
  },
);

test(
  'prepararRaizAlmacenamiento: rechaza un enlace o unión utilizado como raíz',
  async () => {
    await conDirectorioTemporal(async (directorio) => {
      const destino = path.join(directorio, 'destino');
      const enlace = path.join(directorio, 'enlace');

      await mkdir(destino);

      const archivo = path.join(destino, 'contenido.txt');
      await writeFile(archivo, 'Contenido del destino.', 'utf8');

      /*
       * En Windows utilizamos una unión de directorios.
       * En otros sistemas utilizamos un enlace simbólico a directorio.
       *
       * El destino y el enlace pertenecen al directorio temporal.
       */
      await symlink(
        destino,
        enlace,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      await assert.rejects(
        prepararRaizAlmacenamiento(enlace),
        {
          message:
            'La raíz de almacenamiento no puede ser un enlace simbólico ni una unión de directorios.',
        },
      );

      assert.equal(
        await readFile(archivo, 'utf8'),
        'Contenido del destino.',
      );
    });
  },
);

test(
  'prepararRaizAlmacenamiento: rechaza una ruta relativa antes de consultar el disco',
  async () => {
    await assert.rejects(
      prepararRaizAlmacenamiento('storage'),
      {
        message:
          'STORAGE_LOCAL_ROOT debe ser una ruta absoluta.',
      },
    );
  },
);