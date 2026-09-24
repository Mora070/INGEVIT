const test = require('node:test');
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const { join, parse } = require('node:path');
const {
  mkdtemp,
  readdir,
  rm,
  writeFile,
} = require('node:fs/promises');

const {
  crearTemporalCapa,
  getRaizTemporalCapas,
} = require('../dist/modules/capas/utils/crear-temporal-capa');

test('temporales: rechaza rutas relativas y raíces de unidad', () => {
  assert.throws(
    () => getRaizTemporalCapas({ CAPAS_TEMP_ROOT: 'temporales/capas' }),
    /ruta absoluta/,
  );

  assert.throws(
    () => getRaizTemporalCapas({
      CAPAS_TEMP_ROOT: parse(tmpdir()).root,
    }),
    /raíz de una unidad/,
  );
});

test('temporales: impide solaparse con el almacenamiento', () => {
  const base = join(tmpdir(), 'ingevit-config-test');

  for (const [temporal, almacenamiento] of [
    [base, base],
    [join(base, 'trabajos'), base],
    [base, join(base, 'archivos')],
  ]) {
    assert.throws(
      () => getRaizTemporalCapas({
        CAPAS_TEMP_ROOT: temporal,
        STORAGE_LOCAL_ROOT: almacenamiento,
      }),
      /deben estar separados/,
    );
  }

  assert.equal(
    getRaizTemporalCapas({
      CAPAS_TEMP_ROOT: join(base, 'temporales'),
      STORAGE_LOCAL_ROOT: join(base, 'almacenamiento'),
    }),
    join(base, 'temporales'),
  );
});

test('temporales: crea operaciones independientes sin alterar otros archivos', async () => {
  const base = await mkdtemp(join(tmpdir(), 'ingevit-temporal-test-'));

  try {
    const raiz = join(base, 'trabajos', 'capas');
    const primero = await crearTemporalCapa('original', raiz);
    const segundo = await crearTemporalCapa('teselas', raiz);

    assert.notEqual(primero, segundo);

    await writeFile(join(segundo, 'conservar.txt'), 'contenido');
    await rm(primero, { recursive: true, force: true });

    assert.deepEqual(
      (await readdir(segundo)).sort(),
      ['conservar.txt', 'temporal.json'],
    );
    assert.equal((await readdir(raiz)).length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('temporales: rechaza un archivo como componente de la raíz', async () => {
  const base = await mkdtemp(join(tmpdir(), 'ingevit-temporal-test-'));

  try {
    const archivo = join(base, 'archivo');
    await writeFile(archivo, 'no es una carpeta');

    await assert.rejects(
      crearTemporalCapa('original', join(archivo, 'capas')),
      /directorios reales/,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});