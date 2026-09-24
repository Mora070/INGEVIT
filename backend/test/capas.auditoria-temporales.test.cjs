const test = require('node:test');
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const path = require('node:path');
const {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} = require('node:fs/promises');

const {
  auditarTemporalesCapas,
} = require('../scripts/lib/auditar-temporales-capas.cjs');

async function conDirectorio(operacion) {
  const base = await mkdtemp(
    path.join(tmpdir(), 'ingevit-auditoria-temporal-'),
  );

  try {
    await operacion(base);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test('auditoría temporal: informa una raíz ausente sin crearla', async () => {
  await conDirectorio(async (base) => {
    const raiz = path.join(base, 'ausente');
    const resultado = await auditarTemporalesCapas(raiz);

    assert.equal(resultado.raizAusente, true);
    assert.equal(resultado.directoriosReconocidos, 0);
    assert.equal(resultado.bytes, '0');

    await assert.rejects(
      access(raiz),
      (error) => error.code === 'ENOENT',
    );
  });
});

test('auditoría temporal: cuenta originales y teselas sin modificarlos', async () => {
  await conDirectorio(async (base) => {
    const original = await mkdtemp(path.join(base, 'original-'));
    const teselas = await mkdtemp(path.join(base, 'teselas-'));
    const nivel = path.join(teselas, 'resultado', '22', '1');

    await mkdir(nivel, { recursive: true });
    await writeFile(path.join(original, 'original.bin'), Buffer.alloc(7));
    await writeFile(path.join(nivel, '1.png'), Buffer.alloc(11));

    const resultado = await auditarTemporalesCapas(base);

    assert.equal(resultado.directoriosReconocidos, 2);
    assert.equal(resultado.archivos, 2);
    assert.equal(resultado.bytes, '18');
    assert.deepEqual(resultado.entradasNoReconocidas, []);
    assert.deepEqual(
      resultado.temporales.map((temporal) => temporal.tipo),
      ['original', 'teselas'],
    );

    assert.equal(
      (await readFile(path.join(original, 'original.bin'))).length,
      7,
    );
    assert.deepEqual(await readdir(nivel), ['1.png']);
  });
});

test('auditoría temporal: reporta entradas desconocidas sin recorrerlas', async () => {
  await conDirectorio(async (base) => {
    const desconocida = path.join(base, 'otra-carpeta');
    await mkdir(desconocida);
    await writeFile(path.join(desconocida, 'archivo.bin'), Buffer.alloc(50));
    await writeFile(path.join(base, 'nota.txt'), 'conservar');

    const resultado = await auditarTemporalesCapas(base);

    assert.equal(resultado.archivos, 0);
    assert.equal(resultado.bytes, '0');
    assert.deepEqual(
      resultado.entradasNoReconocidas,
      ['nota.txt', 'otra-carpeta'],
    );
    assert.equal(
      await readFile(path.join(base, 'nota.txt'), 'utf8'),
      'conservar',
    );
  });
});

test('auditoría temporal: no recorre junctions o enlaces a otros directorios', async () => {
  await conDirectorio(async (base) => {
    const raiz = path.join(base, 'temporales');
    const externo = path.join(base, 'externo');

    await mkdir(raiz);
    await mkdir(externo);
    await writeFile(path.join(externo, 'respaldo.bin'), Buffer.alloc(100));

    const trabajo = await mkdtemp(path.join(raiz, 'original-'));
    const enlace = path.join(trabajo, 'enlace');

    await symlink(
      externo,
      enlace,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    try {
      const resultado = await auditarTemporalesCapas(raiz);

      assert.equal(resultado.archivos, 0);
      assert.equal(resultado.bytes, '0');
      assert.equal(
        resultado.temporales[0].conEntradasNoReconocidas,
        true,
      );
      assert.deepEqual(resultado.entradasNoReconocidas, [
        `${path.basename(trabajo)}/enlace`,
      ]);
      assert.equal(
        (await readFile(path.join(externo, 'respaldo.bin'))).length,
        100,
      );

      await assert.rejects(
        auditarTemporalesCapas(enlace),
        /componente no válido/,
      );
    } finally {
      await rm(enlace, { force: true });
    }
  });
});