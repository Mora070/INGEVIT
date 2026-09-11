const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validarClaveAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/validar-clave-almacenamiento',
);

const UUID = '50000000-0000-4000-8000-000000000005';

const clavesValidas = [
  ['fotografía', `fotografias/${UUID}.jpg`],
  ['plano', `planos/${UUID}.pdf`],
  ['panorámica', `panoramicas/${UUID}.webp`],
];

for (const [descripcion, clave] of clavesValidas) {
  test(
    `validarClaveAlmacenamiento: acepta una clave de ${descripcion} sin modificarla`,
    () => {
      assert.equal(validarClaveAlmacenamiento(clave), clave);
    },
  );
}

/**
 * Las extensiones se validan aquí únicamente como parte del nombre interno.
 * Los formatos reales permitidos se comprobarán durante la subida.
 */
test(
  'validarClaveAlmacenamiento: no utiliza la extensión para validar el contenido del archivo',
  () => {
    const clave = `fotografias/${UUID}.bin`;

    assert.equal(validarClaveAlmacenamiento(clave), clave);
  },
);

const tiposInvalidos = [
  ['undefined', undefined],
  ['null', null],
  ['número', 123],
  ['objeto', { clave: `fotografias/${UUID}.jpg` }],
  ['arreglo', [`fotografias/${UUID}.jpg`]],
];

for (const [descripcion, clave] of tiposInvalidos) {
  test(
    `validarClaveAlmacenamiento: rechaza un valor de tipo ${descripcion}`,
    () => {
      assert.throws(
        () => validarClaveAlmacenamiento(clave),
        {
          message:
            'La clave de almacenamiento debe ser un texto.',
        },
      );
    },
  );
}

const formatosInvalidos = [
  ['cadena vacía', ''],
  ['ruta relativa ascendente', '../archivo.jpg'],
  [
    'segmentos ascendentes dentro de la categoría',
    'fotografias/../../archivo.jpg',
  ],
  ['ruta absoluta de Windows', 'D:\\documentos\\archivo.jpg'],
  ['ruta absoluta de Unix', '/tmp/archivo.jpg'],
  ['barras invertidas', `fotografias\\${UUID}.jpg`],
  ['subdirectorio adicional', `fotografias/otra/${UUID}.jpg`],
  ['categoría desconocida', `documentos/${UUID}.jpg`],
  ['nombre original', 'fotografias/imagen-original.jpg'],
  ['extensión ausente', `fotografias/${UUID}`],
  ['doble extensión', `fotografias/${UUID}.jpg.exe`],
  ['extensión demasiado larga', `fotografias/${UUID}.abcdefghijk`],
  ['extensión en mayúsculas', `fotografias/${UUID}.JPG`],
  ['espacio inicial', ` fotografias/${UUID}.jpg`],
  ['espacio final', `fotografias/${UUID}.jpg `],
  ['salto de línea final', `fotografias/${UUID}.jpg\n`],
  ['retorno de carro final', `fotografias/${UUID}.jpg\r`],
  ['carácter nulo', `fotografias/${UUID}.jpg\0`],
  ['caracteres codificados', `fotografias/%2e%2e/${UUID}.jpg`],
  ['flujo alternativo de Windows', `fotografias/${UUID}.jpg:datos`],
];

for (const [descripcion, clave] of formatosInvalidos) {
  test(
    `validarClaveAlmacenamiento: rechaza ${descripcion}`,
    () => {
      assert.throws(
        () => validarClaveAlmacenamiento(clave),
        {
          message:
            'La clave de almacenamiento tiene un formato no permitido.',
        },
      );
    },
  );
}