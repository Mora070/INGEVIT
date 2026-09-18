const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  resolverRutaAlmacenamiento,
} = require(
  '../dist/modules/almacenamiento/utils/resolver-ruta-almacenamiento',
);

const UUID = '50000000-0000-4000-8000-000000000005';
const CLAVE = `fotografias/${UUID}.jpg`;

const raizSistema = path.parse(process.cwd()).root;
const directorioRaiz = path.join(
  raizSistema,
  'ingevit-pruebas',
  'storage',
);

/**
 * Estas pruebas solo manipulan rutas como texto.
 * No crean carpetas ni leen, escriben o eliminan archivos.
 */

test(
  'resolverRutaAlmacenamiento: ubica la fotografía dentro de la raíz configurada',
  () => {
    const resultado = resolverRutaAlmacenamiento(
      directorioRaiz,
      CLAVE,
    );

    assert.equal(
      resultado,
      path.join(directorioRaiz, 'fotografias', `${UUID}.jpg`),
    );

    assert.equal(
      path.relative(directorioRaiz, resultado),
      path.join('fotografias', `${UUID}.jpg`),
    );
  },
);

test(
  'resolverRutaAlmacenamiento: normaliza la raíz antes de resolver el archivo',
  () => {
    const entrada =
      `${directorioRaiz}${path.sep}temporal${path.sep}..`;

    assert.equal(
      resolverRutaAlmacenamiento(entrada, CLAVE),
      path.join(directorioRaiz, 'fotografias', `${UUID}.jpg`),
    );
  },
);

test(
  'resolverRutaAlmacenamiento: admite espacios dentro del nombre de la carpeta',
  () => {
    const raizConEspacios = path.join(
      raizSistema,
      'Proyecto INGEVIT',
      'archivos locales',
    );

    assert.equal(
      resolverRutaAlmacenamiento(raizConEspacios, CLAVE),
      path.join(raizConEspacios, 'fotografias', `${UUID}.jpg`),
    );
  },
);

test(
  'resolverRutaAlmacenamiento: admite un separador final en la raíz',
  () => {
    assert.equal(
      resolverRutaAlmacenamiento(
        `${directorioRaiz}${path.sep}`,
        CLAVE,
      ),
      path.join(directorioRaiz, 'fotografias', `${UUID}.jpg`),
    );
  },
);

const raicesInvalidas = [
  ['undefined', undefined],
  ['null', null],
  ['cadena vacía', ''],
  ['ruta relativa', 'storage'],
  ['espacio inicial', ` ${directorioRaiz}`],
  ['espacio final', `${directorioRaiz} `],
  ['carácter nulo', `${directorioRaiz}\0`],
];

for (const [descripcion, raiz] of raicesInvalidas) {
  test(
    `resolverRutaAlmacenamiento: rechaza una raíz con ${descripcion}`,
    () => {
      assert.throws(
        () => resolverRutaAlmacenamiento(raiz, CLAVE),
        {
          message:
            'La raíz de almacenamiento debe ser una ruta absoluta válida.',
        },
      );
    },
  );
}

test(
  'resolverRutaAlmacenamiento: rechaza la raíz del sistema de archivos',
  () => {
    assert.throws(
      () => resolverRutaAlmacenamiento(raizSistema, CLAVE),
      {
        message:
          'La raíz de almacenamiento debe indicar una carpeta.',
      },
    );
  },
);

test(
  'resolverRutaAlmacenamiento: rechaza una raíz que se normaliza a la raíz del sistema',
  () => {
    const entrada =
      `${raizSistema}carpeta-temporal${path.sep}..`;

    assert.throws(
      () => resolverRutaAlmacenamiento(entrada, CLAVE),
      {
        message:
          'La raíz de almacenamiento debe indicar una carpeta.',
      },
    );
  },
);

test(
  'resolverRutaAlmacenamiento: rechaza una clave con segmentos ascendentes',
  () => {
    assert.throws(
      () =>
        resolverRutaAlmacenamiento(
          directorioRaiz,
          'fotografias/../../archivo.jpg',
        ),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );
  },
);

test(
  'resolverRutaAlmacenamiento: rechaza una ruta absoluta utilizada como clave',
  () => {
    const claveAbsoluta = path.join(
      raizSistema,
      'otra-carpeta',
      `${UUID}.jpg`,
    );

    assert.throws(
      () => resolverRutaAlmacenamiento(directorioRaiz, claveAbsoluta),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );
  },
);