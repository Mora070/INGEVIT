require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BadRequestException,
  PayloadTooLargeException,
} = require('@nestjs/common');

const {
  ContenidoPlanoPipe,
} = require('../dist/modules/planos/pipes/contenido-plano.pipe');

const {
  MAX_BYTES_PLANO,
} = require('../dist/modules/planos/config/subida-plano.config');

const entradasInvalidas = [
  ['archivo ausente', undefined],
  ['archivo vacío', { buffer: Buffer.alloc(0) }],
  ['contenido que no es Buffer', { buffer: 'contenido' }],
];

for (const [descripcion, archivo] of entradasInvalidas) {
  test(`ContenidoPlanoPipe: rechaza ${descripcion}`, () => {
    const pipe = new ContenidoPlanoPipe();

    assert.throws(
      () => pipe.transform(archivo),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'Debes proporcionar un archivo de plano no vacío.',
        );
        return true;
      },
    );
  });
}

test(
  'ContenidoPlanoPipe: admite exactamente 35 MiB y devuelve el mismo Buffer',
  () => {
    const pipe = new ContenidoPlanoPipe();
    const contenido = Buffer.alloc(MAX_BYTES_PLANO, 7);

    const resultado = pipe.transform({ buffer: contenido });

    assert.strictEqual(resultado, contenido);
    assert.equal(resultado.length, 36_700_160);
    assert.equal(resultado[0], 7);
    assert.equal(resultado[resultado.length - 1], 7);
  },
);

test(
  'ContenidoPlanoPipe: rechaza 35 MiB más un byte',
  () => {
    const pipe = new ContenidoPlanoPipe();
    const contenido = Buffer.alloc(MAX_BYTES_PLANO + 1);

    assert.throws(
      () => pipe.transform({ buffer: contenido }),
      (error) => {
        assert.ok(error instanceof PayloadTooLargeException);
        assert.equal(error.getStatus(), 413);
        assert.equal(
          error.message,
          'El plano no puede superar 35 MiB.',
        );
        return true;
      },
    );
  },
);