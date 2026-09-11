const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');

const {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  lstat,
  symlink,
  rm,
} = require('node:fs/promises');

const {
  guardarArchivoLocal,
} = require(
  '../dist/modules/almacenamiento/utils/guardar-archivo-local',
);

const {
  prepararDirectoriosAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/preparar-directorios-almacenamiento',
);

/**
 * Crea almacenamiento temporal exclusivo para cada prueba.
 * No utiliza la carpeta real configurada en el backend.
 */
async function conAlmacenamientoTemporal(operacion) {
  const temporal = await mkdtemp(
    path.join(tmpdir(), 'ingevit-escritura-test-'),
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
  'guardarArchivoLocal: escribe el contenido binario completo',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const clave = `fotografias/${nombre}`;

      const fragmentos = [
        Buffer.from([0, 1, 2, 255]),
        Buffer.from([128, 64, 0, 10]),
      ];

      await guardarArchivoLocal(
        raiz,
        clave,
        Readable.from(fragmentos),
      );

      const contenido = await readFile(
        path.join(raiz, 'fotografias', nombre),
      );

      assert.deepEqual(contenido, Buffer.concat(fragmentos));
    });
  },
);

test(
  'guardarArchivoLocal: rechaza una clave existente sin modificar el archivo',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const clave = `fotografias/${nombre}`;
      const ruta = path.join(raiz, 'fotografias', nombre);

      await writeFile(ruta, 'Contenido original.', 'utf8');

      const entrada = Readable.from([
        Buffer.from('Contenido que no debe reemplazarlo.'),
      ]);

      try {
        await assert.rejects(
          guardarArchivoLocal(raiz, clave, entrada),
          (error) => {
            assert.equal(error.code, 'EEXIST');
            return true;
          },
        );

        assert.equal(
          await readFile(ruta, 'utf8'),
          'Contenido original.',
        );
      } finally {
        // La apertura falló antes de que pipeline asumiera el flujo.
        entrada.destroy();
      }
    });
  },
);

test(
  'guardarArchivoLocal: elimina el archivo incompleto cuando falla el flujo de entrada',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const clave = `fotografias/${nombre}`;
      const ruta = path.join(raiz, 'fotografias', nombre);
      const errorEsperado = new Error('Transferencia interrumpida.');

      async function* contenidoConFallo() {
        yield Buffer.from('Primer fragmento.');
        throw errorEsperado;
      }

      const entrada = Readable.from(contenidoConFallo());

      try {
        await assert.rejects(
          guardarArchivoLocal(raiz, clave, entrada),
          (error) => error === errorEsperado,
        );

        await assert.rejects(
          lstat(ruta),
          (error) => {
            assert.equal(error.code, 'ENOENT');
            return true;
          },
        );

        assert.deepEqual(
          await readdir(path.join(raiz, 'fotografias')),
          [],
        );
      } finally {
        entrada.destroy();
      }
    });
  },
);

test(
  'guardarArchivoLocal: rechaza una clave inválida sin crear archivos',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const entrada = Readable.from([Buffer.from('Contenido.')]);

      try {
        await assert.rejects(
          guardarArchivoLocal(
            raiz,
            'fotografias/../../archivo.jpg',
            entrada,
          ),
          {
            message:
              'La clave de almacenamiento tiene un formato no permitido.',
          },
        );

        assert.deepEqual(
          await readdir(path.join(raiz, 'fotografias')),
          [],
        );
      } finally {
        entrada.destroy();
      }
    });
  },
);

test(
  'guardarArchivoLocal: rechaza una categoría sustituida por una unión o enlace',
  async () => {
    await conAlmacenamientoTemporal(async ({ temporal, raiz }) => {
      const categoria = path.join(raiz, 'fotografias');
      const destino = path.join(temporal, 'destino-externo');

      await mkdir(destino);

      // La categoría está vacía y pertenece a esta prueba.
      await rm(categoria, { recursive: true });

      await symlink(
        destino,
        categoria,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      const entrada = Readable.from([Buffer.from('Contenido.')]);

      try {
        await assert.rejects(
          guardarArchivoLocal(
            raiz,
            `fotografias/${randomUUID()}.jpg`,
            entrada,
          ),
          {
            message:
              'La carpeta de destino no puede ser un enlace simbólico ni una unión de directorios.',
          },
        );

        assert.deepEqual(await readdir(destino), []);
      } finally {
        entrada.destroy();
      }
    });
  },
);

test(
  'guardarArchivoLocal: solo permite una escritura concurrente para la misma clave',
  async () => {
    await conAlmacenamientoTemporal(async ({ raiz }) => {
      const nombre = `${randomUUID()}.jpg`;
      const clave = `fotografias/${nombre}`;
      const contenidos = [
        Buffer.from('Contenido de la primera operación.'),
        Buffer.from('Contenido de la segunda operación.'),
      ];

      const entradas = contenidos.map((contenido) =>
        Readable.from([contenido]),
      );

      try {
        const resultados = await Promise.allSettled(
          entradas.map((entrada) =>
            guardarArchivoLocal(raiz, clave, entrada),
          ),
        );

        const exitosos = resultados.filter(
          (resultado) => resultado.status === 'fulfilled',
        );
        const fallidos = resultados.filter(
          (resultado) => resultado.status === 'rejected',
        );

        assert.equal(exitosos.length, 1);
        assert.equal(fallidos.length, 1);
        assert.equal(fallidos[0].reason.code, 'EEXIST');

        const indiceGanador = resultados.findIndex(
          (resultado) => resultado.status === 'fulfilled',
        );

        assert.deepEqual(
          await readFile(path.join(raiz, 'fotografias', nombre)),
          contenidos[indiceGanador],
        );
      } finally {
        for (const entrada of entradas) {
          entrada.destroy();
        }
      }
    });
  },
);