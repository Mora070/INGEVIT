require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const {
  PlanosDescargaRepository,
} = require('../dist/modules/planos/planos-descarga.repository');

const {
  PlanosDescargaService,
} = require('../dist/modules/planos/planos-descarga.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const NOMBRE = '30000000-0000-4000-8000-000000000001.pdf';
const CLAVE = `planos/${NOMBRE}`;

test('PlanosDescargaRepository: parametriza la búsqueda y limita los campos devueltos', async () => {
  const claveExterna = "planos/archivo'); SELECT 1; --";

  const repository = new PlanosDescargaRepository({
    async query(sql, valores) {
      assert.deepEqual(valores, [PROYECTO, USUARIO, claveExterna]);
      assert.equal(sql.includes(claveExterna), false);

      return {
        rows: [{ s3_key: CLAVE, campo_interno: 'no publicar' }],
      };
    },
  });

  assert.deepEqual(
    await repository.buscarDisponible(PROYECTO, USUARIO, claveExterna),
    { s3_key: CLAVE },
  );
});

test('PlanosDescargaRepository: devuelve null cuando no hay acceso o registro', async () => {
  const repository = new PlanosDescargaRepository({
    async query() {
      return { rows: [] };
    },
  });

  assert.equal(
    await repository.buscarDisponible(PROYECTO, USUARIO, CLAVE),
    null,
  );
});

test('PlanosDescarga: abre el archivo después de consultar el acceso', async () => {
  const eventos = [];
  const flujo = Readable.from([Buffer.from('pdf')]);

  const service = new PlanosDescargaService(
    {
      async buscarDisponible(...argumentos) {
        assert.deepEqual(argumentos, [PROYECTO, USUARIO, CLAVE]);
        eventos.push('acceso');
        return { s3_key: CLAVE };
      },
    },
    {
      async abrirLectura(clave) {
        assert.equal(clave, CLAVE);
        eventos.push('archivo');
        return flujo;
      },
    },
  );

  try {
    assert.strictEqual(
      await service.abrir(PROYECTO, USUARIO, NOMBRE),
      flujo,
    );
    assert.deepEqual(eventos, ['acceso', 'archivo']);
  } finally {
    flujo.destroy();
  }
});

test('PlanosDescarga: rechaza nombres inválidos antes de consultar PostgreSQL', async () => {
  const service = new PlanosDescargaService(
    {
      async buscarDisponible() {
        assert.fail('No debe consultar un nombre inválido.');
      },
    },
    {
      async abrirLectura() {
        assert.fail('No debe abrir un nombre inválido.');
      },
    },
  );

  for (const nombre of [
    '../archivo.pdf',
    `planos/${NOMBRE}`,
    `${NOMBRE}\n`,
    `${NOMBRE}\r`,
    NOMBRE.toUpperCase(),
    NOMBRE.replace('.pdf', '.webp'),
    '',
  ]) {
    await assert.rejects(
      service.abrir(PROYECTO, USUARIO, nombre),
      (error) => error.getStatus() === 404,
    );
  }
});

test('PlanosDescarga: no abre el almacenamiento cuando el plano no está disponible', async () => {
  const service = new PlanosDescargaService(
    {
      async buscarDisponible() {
        return null;
      },
    },
    {
      async abrirLectura() {
        assert.fail('No debe abrir un archivo sin acceso.');
      },
    },
  );

  await assert.rejects(
    service.abrir(PROYECTO, USUARIO, NOMBRE),
    (error) => error.getStatus() === 404,
  );
});

test('PlanosDescarga: propaga un fallo de PostgreSQL sin abrir el archivo', async () => {
  const original = new Error('PostgreSQL no disponible');

  const repository = new PlanosDescargaRepository({
    async query() {
      throw original;
    },
  });

  const service = new PlanosDescargaService(repository, {
    async abrirLectura() {
      assert.fail('No debe abrir si la consulta falla.');
    },
  });

  await assert.rejects(
    service.abrir(PROYECTO, USUARIO, NOMBRE),
    (error) => error === original,
  );
});

test('PlanosDescarga: propaga el fallo del almacenamiento', async () => {
  const original = new Error('Error de lectura');

  const service = new PlanosDescargaService(
    {
      async buscarDisponible() {
        return { s3_key: CLAVE };
      },
    },
    {
      async abrirLectura() {
        throw original;
      },
    },
  );

  await assert.rejects(
    service.abrir(PROYECTO, USUARIO, NOMBRE),
    (error) => error === original,
  );
});