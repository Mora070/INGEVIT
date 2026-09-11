const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generarUrlFotografia,
} = require(
  '../dist/modules/fotografias/utils/generar-url-fotografia',
);

const ID_PROYECTO = 'a0000000-0000-4000-8000-000000000002';
const ID_ARCHIVO = '50000000-0000-4000-8000-000000000005';
const CLAVE_OPTIMIZADA = `fotografias/${ID_ARCHIVO}.webp`;

test(
  'generarUrlFotografia: construye una ruta de API para el proyecto y archivo indicados',
  () => {
    assert.equal(
      generarUrlFotografia(ID_PROYECTO, CLAVE_OPTIMIZADA),
      `/api/proyectos/${ID_PROYECTO}/fotografias/archivos/${ID_ARCHIVO}.webp`,
    );
  },
);

test(
  'generarUrlFotografia: normaliza el UUID del proyecto a minúsculas',
  () => {
    assert.equal(
      generarUrlFotografia(
        ID_PROYECTO.toUpperCase(),
        CLAVE_OPTIMIZADA,
      ),
      `/api/proyectos/${ID_PROYECTO}/fotografias/archivos/${ID_ARCHIVO}.webp`,
    );
  },
);

const proyectosInvalidos = [
  ['identificador mal formado', 'proyecto-invalido'],
  ['valor nulo', null],
  ['salto de línea final', `${ID_PROYECTO}\n`],
];

for (const [descripcion, idProyecto] of proyectosInvalidos) {
  test(
    `generarUrlFotografia: rechaza ${descripcion}`,
    () => {
      assert.throws(
        () => generarUrlFotografia(
          idProyecto,
          CLAVE_OPTIMIZADA,
        ),
        {
          message:
            'El identificador del proyecto debe ser un UUID válido.',
        },
      );
    },
  );
}

test(
  'generarUrlFotografia: rechaza una clave de otra categoría',
  () => {
    assert.throws(
      () => generarUrlFotografia(
        ID_PROYECTO,
        `panoramicas/${ID_ARCHIVO}.webp`,
      ),
      {
        message:
          'La URL de fotografía debe corresponder a una versión optimizada WebP.',
      },
    );
  },
);

test(
  'generarUrlFotografia: rechaza una clave con extensión distinta de WebP',
  () => {
    assert.throws(
      () => generarUrlFotografia(
        ID_PROYECTO,
        `fotografias/${ID_ARCHIVO}.jpeg`,
      ),
      {
        message:
          'La URL de fotografía debe corresponder a una versión optimizada WebP.',
      },
    );
  },
);

test(
  'generarUrlFotografia: rechaza segmentos ascendentes en la clave',
  () => {
    assert.throws(
      () => generarUrlFotografia(
        ID_PROYECTO,
        'fotografias/../../archivo.webp',
      ),
      {
        message:
          'La clave de almacenamiento tiene un formato no permitido.',
      },
    );
  },
);