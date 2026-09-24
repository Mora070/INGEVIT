const test = require('node:test');
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const path = require('node:path');
const {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} = require('node:fs/promises');

const {
  crearTemporalCapa,
} = require('../dist/modules/capas/utils/crear-temporal-capa');

const {
  leerRegistroTemporal,
} = require('../scripts/lib/leer-registro-temporal.cjs');

const {
  auditarTemporalesCapas,
} = require('../scripts/lib/auditar-temporales-capas.cjs');

async function conRaiz(operacion) {
  const raiz = await mkdtemp(
    path.join(tmpdir(), 'ingevit-registro-test-'),
  );

  try {
    await operacion(raiz);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
}

test('registro temporal: identifica trabajos distintos de la misma ejecución', async () => {
  await conRaiz(async (raiz) => {
    const original = await crearTemporalCapa('original', raiz);
    const teselas = await crearTemporalCapa('teselas', raiz);

    const primero = await leerRegistroTemporal(original, 'original');
    const segundo = await leerRegistroTemporal(teselas, 'teselas');

    assert.equal(primero.estado, 'VALIDO');
    assert.equal(segundo.estado, 'VALIDO');
    assert.notEqual(primero.datos.idTemporal, segundo.datos.idTemporal);
    assert.equal(
      primero.datos.ejecucion.id,
      segundo.datos.ejecucion.id,
    );
    assert.equal(primero.datos.ejecucion.pid, process.pid);

    const informe = await auditarTemporalesCapas(raiz);

    assert.equal(informe.directoriosReconocidos, 2);
    assert.equal(informe.archivos, 2);
    assert.ok(
      informe.temporales.every(
        (temporal) => temporal.registro.estado === 'VALIDO',
      ),
    );
  });
});

test('registro temporal: reconoce ausencia y JSON incompleto sin modificarlo', async () => {
  await conRaiz(async (raiz) => {
    const temporal = await mkdtemp(path.join(raiz, 'original-'));

    assert.deepEqual(
      await leerRegistroTemporal(temporal, 'original'),
      { estado: 'AUSENTE', datos: null },
    );

    const archivo = path.join(temporal, 'temporal.json');
    await writeFile(archivo, '{"version":');

    assert.deepEqual(
      await leerRegistroTemporal(temporal, 'original'),
      { estado: 'INVALIDO', datos: null },
    );
    assert.equal(await readFile(archivo, 'utf8'), '{"version":');
  });
});

test('registro temporal: rechaza tipo incorrecto y metadatos alterados', async () => {
  await conRaiz(async (raiz) => {
    const temporal = await crearTemporalCapa('original', raiz);
    const archivo = path.join(temporal, 'temporal.json');
    const original = JSON.parse(await readFile(archivo, 'utf8'));

    assert.equal(
      (await leerRegistroTemporal(temporal, 'teselas')).estado,
      'INVALIDO',
    );

    const variantes = [
      { ...original, version: 2 },
      { ...original, idTemporal: 'incorrecto' },
      { ...original, fechaCreacion: 'ayer' },
      {
        ...original,
        ejecucion: { ...original.ejecucion, pid: 0 },
      },
      {
        ...original,
        ejecucion: { ...original.ejecucion, id: 'incorrecto' },
      },
    ];

    for (const variante of variantes) {
      await writeFile(archivo, JSON.stringify(variante));

      assert.equal(
        (await leerRegistroTemporal(temporal, 'original')).estado,
        'INVALIDO',
      );
    }
  });
});