const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getArchivosPendientesConfig,
} = require('../dist/modules/almacenamiento/config/archivos-pendientes.config');

test(
  'config pendientes: utiliza los valores predeterminados y permanece desactivado',
  () => {
    assert.deepEqual(getArchivosPendientesConfig({}), {
      habilitado: false,
      intervaloMs: 5000,
      demoraReintentoSegundos: 60,
      maxTareasPorCiclo: 10,
    });
  },
);

test(
  'config pendientes: acepta valores explícitos sin modificar el entorno recibido',
  () => {
    const env = Object.freeze({
      ARCHIVOS_PENDIENTES_HABILITADO: 'true',
      ARCHIVOS_PENDIENTES_INTERVALO_MS: '2000',
      ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS: '120',
      ARCHIVOS_PENDIENTES_MAX_TAREAS: '5',
    });

    assert.deepEqual(getArchivosPendientesConfig(env), {
      habilitado: true,
      intervaloMs: 2000,
      demoraReintentoSegundos: 120,
      maxTareasPorCiclo: 5,
    });
  },
);

test(
  'config pendientes: acepta desactivación explícita',
  () => {
    assert.equal(
      getArchivosPendientesConfig({
        ARCHIVOS_PENDIENTES_HABILITADO: 'false',
      }).habilitado,
      false,
    );
  },
);

test(
  'config pendientes: acepta los límites mínimos',
  () => {
    assert.deepEqual(
      getArchivosPendientesConfig({
        ARCHIVOS_PENDIENTES_INTERVALO_MS: '1000',
        ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS: '1',
        ARCHIVOS_PENDIENTES_MAX_TAREAS: '1',
      }),
      {
        habilitado: false,
        intervaloMs: 1000,
        demoraReintentoSegundos: 1,
        maxTareasPorCiclo: 1,
      },
    );
  },
);

test(
  'config pendientes: acepta los límites máximos',
  () => {
    assert.deepEqual(
      getArchivosPendientesConfig({
        ARCHIVOS_PENDIENTES_INTERVALO_MS: '300000',
        ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS: '86400',
        ARCHIVOS_PENDIENTES_MAX_TAREAS: '100',
      }),
      {
        habilitado: false,
        intervaloMs: 300000,
        demoraReintentoSegundos: 86400,
        maxTareasPorCiclo: 100,
      },
    );
  },
);

const casosInvalidos = [
  [
    'activación con mayúsculas',
    'ARCHIVOS_PENDIENTES_HABILITADO',
    'TRUE',
    'ARCHIVOS_PENDIENTES_HABILITADO debe ser true o false.',
  ],
  [
    'intervalo vacío',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    '',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS debe ser un entero entre 1000 y 300000.',
  ],
  [
    'intervalo con espacios',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    ' 5000 ',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS debe ser un entero entre 1000 y 300000.',
  ],
  [
    'intervalo con salto de línea',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    '5000\n',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS debe ser un entero entre 1000 y 300000.',
  ],
  [
    'intervalo inferior al mínimo',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    '999',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS debe ser un entero entre 1000 y 300000.',
  ],
  [
    'intervalo superior al máximo',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS',
    '300001',
    'ARCHIVOS_PENDIENTES_INTERVALO_MS debe ser un entero entre 1000 y 300000.',
  ],
  [
    'reintento decimal',
    'ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS',
    '1.5',
    'ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS debe ser un entero entre 1 y 86400.',
  ],
  [
    'reintento negativo',
    'ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS',
    '-1',
    'ARCHIVOS_PENDIENTES_REINTENTO_SEGUNDOS debe ser un entero entre 1 y 86400.',
  ],
  [
    'cantidad de tareas igual a cero',
    'ARCHIVOS_PENDIENTES_MAX_TAREAS',
    '0',
    'ARCHIVOS_PENDIENTES_MAX_TAREAS debe ser un entero entre 1 y 100.',
  ],
  [
    'cantidad de tareas superior al máximo',
    'ARCHIVOS_PENDIENTES_MAX_TAREAS',
    '101',
    'ARCHIVOS_PENDIENTES_MAX_TAREAS debe ser un entero entre 1 y 100.',
  ],
];

for (const [descripcion, nombre, valor, mensaje] of casosInvalidos) {
  test(
    `config pendientes: rechaza ${descripcion} aunque el trabajador esté desactivado`,
    () => {
      assert.throws(
        () =>
          getArchivosPendientesConfig({
            ARCHIVOS_PENDIENTES_HABILITADO: 'false',
            [nombre]: valor,
          }),
        { message: mensaje },
      );
    },
  );
}