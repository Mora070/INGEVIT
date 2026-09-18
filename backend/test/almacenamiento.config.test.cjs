const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  getAlmacenamientoLocalConfig,
} = require(
  '../dist/modules/almacenamiento/config/almacenamiento.config',
);

/**
 * Construimos rutas compatibles con el sistema donde se ejecutan las pruebas.
 * No creamos carpetas ni escribimos archivos.
 */
const raizSistema = path.parse(process.cwd()).root;
const directorioValido = path.join(
  raizSistema,
  'ingevit-pruebas',
  'storage',
);

test(
  'almacenamiento: acepta una carpeta absoluta',
  () => {
    const resultado = getAlmacenamientoLocalConfig({
      STORAGE_LOCAL_ROOT: directorioValido,
    });

    assert.deepEqual(resultado, {
      directorioRaiz: directorioValido,
    });
  },
);

test(
  'almacenamiento: normaliza los segmentos de la ruta',
  () => {
    // No usamos path.join aquí porque normalizaría la entrada antes de probarla.
    const entrada =
      `${directorioValido}${path.sep}temporal${path.sep}..`;

    const resultado = getAlmacenamientoLocalConfig({
      STORAGE_LOCAL_ROOT: entrada,
    });

    assert.equal(resultado.directorioRaiz, directorioValido);
  },
);

test(
  'almacenamiento: permite espacios dentro del nombre de una carpeta',
  () => {
    const entrada = path.join(
      raizSistema,
      'Proyecto INGEVIT',
      'archivos locales',
    );

    const resultado = getAlmacenamientoLocalConfig({
      STORAGE_LOCAL_ROOT: entrada,
    });

    assert.equal(resultado.directorioRaiz, entrada);
  },
);

test(
  'almacenamiento: no modifica la configuración recibida',
  () => {
    const env = Object.freeze({
      STORAGE_LOCAL_ROOT: directorioValido,
      OTRA_VARIABLE: 'valor original',
    });

    const resultado = getAlmacenamientoLocalConfig(env);

    assert.equal(resultado.directorioRaiz, directorioValido);
    assert.equal(env.STORAGE_LOCAL_ROOT, directorioValido);
    assert.equal(env.OTRA_VARIABLE, 'valor original');
  },
);

const casosInvalidos = [
  [
    'variable ausente',
    {},
    'La variable STORAGE_LOCAL_ROOT es obligatoria.',
  ],
  [
    'valor vacío',
    { STORAGE_LOCAL_ROOT: '' },
    'La variable STORAGE_LOCAL_ROOT es obligatoria.',
  ],
  [
    'valor compuesto solo por espacios',
    { STORAGE_LOCAL_ROOT: '   ' },
    'La variable STORAGE_LOCAL_ROOT es obligatoria.',
  ],
  [
    'espacio inicial',
    { STORAGE_LOCAL_ROOT: ` ${directorioValido}` },
    'STORAGE_LOCAL_ROOT no debe tener espacios al inicio o al final.',
  ],
  [
    'espacio final',
    { STORAGE_LOCAL_ROOT: `${directorioValido} ` },
    'STORAGE_LOCAL_ROOT no debe tener espacios al inicio o al final.',
  ],
  [
    'carácter nulo',
    { STORAGE_LOCAL_ROOT: `${directorioValido}\0archivo` },
    'STORAGE_LOCAL_ROOT contiene un carácter no permitido.',
  ],
  [
    'ruta relativa',
    { STORAGE_LOCAL_ROOT: 'storage' },
    'STORAGE_LOCAL_ROOT debe ser una ruta absoluta.',
  ],
  [
    'raíz del sistema de archivos',
    { STORAGE_LOCAL_ROOT: raizSistema },
    'STORAGE_LOCAL_ROOT debe indicar una carpeta, no la raíz del sistema de archivos.',
  ],
  [
    'ruta que se normaliza a la raíz',
    {
      STORAGE_LOCAL_ROOT:
        `${raizSistema}carpeta-temporal${path.sep}..`,
    },
    'STORAGE_LOCAL_ROOT debe indicar una carpeta, no la raíz del sistema de archivos.',
  ],
];

for (const [descripcion, env, mensaje] of casosInvalidos) {
  test(
    `almacenamiento: rechaza ${descripcion}`,
    () => {
      assert.throws(
        () => getAlmacenamientoLocalConfig(env),
        { message: mensaje },
      );
    },
  );
}