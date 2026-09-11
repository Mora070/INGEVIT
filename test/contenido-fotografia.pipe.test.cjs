require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ContenidoFotografiaPipe,
} = require('../dist/modules/fotografias/pipes/contenido-fotografia.pipe');

/**
 * Verifica el contrato del error HTTP sin depender de detalles
 * internos de la implementación de NestJS.
 */
function comprobarArchivoRechazado(archivo) {
  const pipe = new ContenidoFotografiaPipe();

  assert.throws(
    () => pipe.transform(archivo),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'Debes proporcionar un archivo de fotografía no vacío.',
      );

      return true;
    },
  );
}

test('ContenidoFotografiaPipe: rechaza un archivo ausente', () => {
  comprobarArchivoRechazado(undefined);
});

test('ContenidoFotografiaPipe: rechaza un archivo sin buffer', () => {
  comprobarArchivoRechazado({
    originalname: 'fotografia.jpg',
    mimetype: 'image/jpeg',
  });
});

test('ContenidoFotografiaPipe: rechaza un buffer vacío', () => {
  comprobarArchivoRechazado({
    buffer: Buffer.alloc(0),
  });
});

test('ContenidoFotografiaPipe: rechaza contenido que no es un Buffer', () => {
  comprobarArchivoRechazado({
    buffer: 'contenido inválido',
  });
});

test('ContenidoFotografiaPipe: devuelve el mismo Buffer sin modificarlo', () => {
  const pipe = new ContenidoFotografiaPipe();

  const contenido = Buffer.from([0, 10, 127, 128, 255]);
  const copia = Buffer.from(contenido);

  const resultado = pipe.transform({
    buffer: contenido,
  });

  // No crea una copia adicional del archivo en memoria.
  assert.strictEqual(resultado, contenido);

  // Los bytes recibidos permanecen intactos.
  assert.deepEqual(contenido, copia);
});

test('ContenidoFotografiaPipe: deja la validación del formato al servicio', () => {
  const pipe = new ContenidoFotografiaPipe();

  /*
   * Este contenido no es una imagen.
   * El pipe solo extrae los bytes; el procesamiento posterior
   * deberá rechazarlo al intentar interpretar la fotografía.
   */
  const contenido = Buffer.from('Esto no es una fotografía.');

  const resultado = pipe.transform({
    originalname: 'apariencia.jpg',
    mimetype: 'image/jpeg',
    buffer: contenido,
  });

  assert.strictEqual(resultado, contenido);
});