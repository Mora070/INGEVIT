const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generarClavesFotografia,
} = require(
  '../dist/modules/fotografias/utils/generar-claves-fotografia',
);

const {
  validarClaveAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/validar-clave-almacenamiento',
);

/**
 * randomUUID genera UUID versión 4.
 * Comprobamos su formato sin depender de un identificador concreto.
 */
const PATRON_UUID_V4 =
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

for (const formato of ['jpeg', 'png', 'webp']) {
  test(
    `generarClavesFotografia: genera claves independientes para un original ${formato}`,
    () => {
      const resultado = generarClavesFotografia(formato);

      assert.deepEqual(
        Object.keys(resultado).sort(),
        ['original_s3_key', 's3_key'],
      );

      assert.match(
        resultado.original_s3_key,
        new RegExp(`^fotografias/${PATRON_UUID_V4}\\.${formato}$`),
      );

      assert.match(
        resultado.s3_key,
        new RegExp(`^fotografias/${PATRON_UUID_V4}\\.webp$`),
      );

      assert.notEqual(
        resultado.original_s3_key,
        resultado.s3_key,
      );

      // Ambos identificadores deben ser independientes,
      // incluso cuando las extensiones sean distintas.
      const idOriginal =
        resultado.original_s3_key.split('/')[1].split('.')[0];

      const idOptimizada =
        resultado.s3_key.split('/')[1].split('.')[0];

      assert.notEqual(idOriginal, idOptimizada);

      assert.equal(
        validarClaveAlmacenamiento(resultado.original_s3_key),
        resultado.original_s3_key,
      );

      assert.equal(
        validarClaveAlmacenamiento(resultado.s3_key),
        resultado.s3_key,
      );
    },
  );
}

test(
  'generarClavesFotografia: genera nuevas referencias en llamadas sucesivas',
  () => {
    const primera = generarClavesFotografia('jpeg');
    const segunda = generarClavesFotografia('jpeg');

    const claves = [
      primera.original_s3_key,
      primera.s3_key,
      segunda.original_s3_key,
      segunda.s3_key,
    ];

    assert.equal(new Set(claves).size, 4);
  },
);

const formatosInvalidos = [
  ['formato no permitido', 'gif'],
  ['extensión jpg sin normalizar', 'jpg'],
  ['formato en mayúsculas', 'JPEG'],
  ['cadena vacía', ''],
  ['valor nulo', null],
];

for (const [descripcion, formato] of formatosInvalidos) {
  test(
    `generarClavesFotografia: rechaza ${descripcion}`,
    () => {
      assert.throws(
        () => generarClavesFotografia(formato),
        {
          message:
            'No se pueden generar claves para un formato de fotografía no permitido.',
        },
      );
    },
  );
}