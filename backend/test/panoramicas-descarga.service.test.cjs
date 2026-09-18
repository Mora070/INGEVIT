require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const {
  PanoramicasDescargaService,
} = require('../dist/modules/panoramicas/panoramicas-descarga.service');

const NOMBRE = '30000000-0000-4000-8000-000000000001.webp';
const CLAVE = `panoramicas/${NOMBRE}`;

test('PanoramicasDescarga: consulta el acceso antes de abrir y devuelve el MIME', async () => {
  const eventos = [];
  const flujo = Readable.from([Buffer.from('imagen')]);

  const service = new PanoramicasDescargaService(
    {
      async buscarDisponible(...argumentos) {
        assert.deepEqual(argumentos, ['proyecto', 'usuario', CLAVE]);
        eventos.push('acceso');
        return { s3_key: CLAVE, mime_type: 'image/webp' };
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
    const resultado = await service.abrir('proyecto', 'usuario', NOMBRE);

    assert.strictEqual(resultado.flujo, flujo);
    assert.equal(resultado.mimeType, 'image/webp');
    assert.deepEqual(eventos, ['acceso', 'archivo']);
  } finally {
    flujo.destroy();
  }
});

test('PanoramicasDescarga: rechaza nombres inválidos sin consultar', async () => {
  const service = new PanoramicasDescargaService(
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
    '../imagen.webp',
    `panoramicas/${NOMBRE}`,
    `${NOMBRE}\n`,
    `${NOMBRE}\r`,
    NOMBRE.replace('.webp', '.svg'),
    '',
  ]) {
    await assert.rejects(
      service.abrir('proyecto', 'usuario', nombre),
      (error) => error.getStatus() === 404,
    );
  }
});

test('PanoramicasDescarga: no abre un archivo sin acceso', async () => {
  const service = new PanoramicasDescargaService(
    {
      async buscarDisponible() {
        return null;
      },
    },
    {
      async abrirLectura() {
        assert.fail('No debe abrir sin acceso.');
      },
    },
  );

  await assert.rejects(
    service.abrir('proyecto', 'usuario', NOMBRE),
    (error) => error.getStatus() === 404,
  );
});

test('PanoramicasDescarga: rechaza un MIME inesperado antes de abrir', async () => {
  const service = new PanoramicasDescargaService(
    {
      async buscarDisponible() {
        return { s3_key: CLAVE, mime_type: 'text/html' };
      },
    },
    {
      async abrirLectura() {
        assert.fail('No debe abrir con un MIME inesperado.');
      },
    },
  );

  await assert.rejects(
    service.abrir('proyecto', 'usuario', NOMBRE),
    { message: 'La panorámica tiene un tipo MIME inesperado.' },
  );
});

test('PanoramicasDescarga: propaga el error de lectura', async () => {
  const original = new Error('Falló el almacenamiento');

  const service = new PanoramicasDescargaService(
    {
      async buscarDisponible() {
        return { s3_key: CLAVE, mime_type: 'image/webp' };
      },
    },
    {
      async abrirLectura() {
        throw original;
      },
    },
  );

  await assert.rejects(
    service.abrir('proyecto', 'usuario', NOMBRE),
    (error) => error === original,
  );
});