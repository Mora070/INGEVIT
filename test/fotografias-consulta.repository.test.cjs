require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasConsultaRepository,
} = require('../dist/modules/fotografias/fotografias-consulta.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearFotografia() {
  return {
    id_fotografia: '50000000-0000-4000-8000-000000000005',
    id_proyecto: ID_PROYECTO,
    id_usuario_subida: ID_USUARIO,
    titulo: 'Fotografía de prueba',
    url: 'https://example.invalid/fotografia.jpg',
    s3_key: 'fotografias/archivo-de-prueba.jpg',
    original_s3_key:'fotografias/60000000-0000-4000-8000-000000000006.jpg',
    fecha_subida: new Date('2026-09-10T15:30:00.000Z'),
  };
}

/**
 * Representa la fila del LEFT JOIN cuando el proyecto está disponible,
 * pero la página solicitada no contiene fotografías.
 */
function crearPaginaVacia(total) {
  return {
    id_fotografia: null,
    id_proyecto: null,
    id_usuario_subida: null,
    titulo: null,
    url: null,
    s3_key: null,
    original_s3_key: null,
    fecha_subida: null,
    total,
  };
}

/**
 * Simula DatabaseService y registra las consultas recibidas.
 *
 * No ejecuta SQL. Los permisos y el orden de los resultados se
 * comprobarán posteriormente mediante una prueba de integración.
 */
function crearEscenario({ filas = [], errorConsulta } = {}) {
  const consultas = [];

  const database = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros });

      if (errorConsulta) {
        throw errorConsulta;
      }

      return {
        rows: filas,
        rowCount: filas.length,
      };
    },
  };

  return {
    repositorio: new FotografiasConsultaRepository(database),
    consultas,
  };
}

test(
  'fotografías: parametriza la consulta y separa el conteo de los registros',
  async () => {
    const fotografia = crearFotografia();

    const { repositorio, consultas } = crearEscenario({
      filas: [{ ...fotografia, total: '45' }],
    });

    const resultado = await repositorio.findDisponiblesPaginadas(
      ID_PROYECTO,
      ID_USUARIO,
      3,
      20,
    );

    assert.deepEqual(resultado, {
      fotografias: [fotografia],
      total: 45,
    });

    assert.equal(consultas.length, 1);

    // Página 3 con límite 20: omitir los primeros 40 registros.
    assert.deepEqual(consultas[0].parametros, [
      ID_PROYECTO,
      ID_USUARIO,
      20,
      40,
    ]);

    assert.equal(
      consultas[0].sql.includes(ID_PROYECTO),
      false,
    );
    assert.equal(
      consultas[0].sql.includes(ID_USUARIO),
      false,
    );

    assert.equal(
      Object.hasOwn(resultado.fotografias[0], 'total'),
      false,
    );

    // El repositorio conserva la clave interna; el mapeador la excluye.
    assert.equal(
      resultado.fotografias[0].s3_key,
      fotografia.s3_key,
    );

    assert.equal(
      resultado.fotografias[0].original_s3_key,
      fotografia.original_s3_key,
    );
  },
);

test(
  'fotografías: devuelve null cuando el proyecto no está disponible',
  async () => {
    const { repositorio } = crearEscenario();

    const resultado = await repositorio.findDisponiblesPaginadas(
      ID_PROYECTO,
      ID_USUARIO,
      1,
      20,
    );

    assert.equal(resultado, null);
  },
);

test(
  'fotografías: devuelve un arreglo vacío y total cero para un proyecto sin fotografías',
  async () => {
    const { repositorio, consultas } = crearEscenario({
      filas: [crearPaginaVacia('0')],
    });

    const resultado = await repositorio.findDisponiblesPaginadas(
      ID_PROYECTO,
      ID_USUARIO,
      1,
      20,
    );

    assert.deepEqual(resultado, {
      fotografias: [],
      total: 0,
    });

    assert.equal(consultas[0].parametros[3], 0);
  },
);

test(
  'fotografías: conserva el total cuando la página solicitada está vacía',
  async () => {
    const { repositorio } = crearEscenario({
      filas: [crearPaginaVacia('45')],
    });

    const resultado = await repositorio.findDisponiblesPaginadas(
      ID_PROYECTO,
      ID_USUARIO,
      4,
      20,
    );

    assert.deepEqual(resultado, {
      fotografias: [],
      total: 45,
    });
  },
);

test(
  'fotografías: rechaza un conteo superior al entero seguro de JavaScript',
  async () => {
    const { repositorio } = crearEscenario({
      filas: [crearPaginaVacia('9007199254740992')],
    });

    await assert.rejects(
      repositorio.findDisponiblesPaginadas(
        ID_PROYECTO,
        ID_USUARIO,
        1,
        20,
      ),
      {
        message:
          'El total de fotografías no puede representarse correctamente.',
      },
    );
  },
);

const conteosInvalidos = [
  ['vacío', ''],
  ['negativo', '-1'],
  ['decimal', '1.5'],
  ['numérico en lugar de texto', 10],
  ['nulo', null],
];

for (const [descripcion, total] of conteosInvalidos) {
  test(
    `fotografías: rechaza un conteo ${descripcion}`,
    async () => {
      const { repositorio } = crearEscenario({
        filas: [crearPaginaVacia(total)],
      });

      await assert.rejects(
        repositorio.findDisponiblesPaginadas(
          ID_PROYECTO,
          ID_USUARIO,
          1,
          20,
        ),
        {
          message:
            'El conteo de fotografías tiene un formato inesperado.',
        },
      );
    },
  );
}

test(
  'fotografías: propaga el error original de la base de datos',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const { repositorio, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      repositorio.findDisponiblesPaginadas(
        ID_PROYECTO,
        ID_USUARIO,
        1,
        20,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);