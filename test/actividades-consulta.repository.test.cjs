require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ActividadesConsultaRepository,
} = require('../dist/modules/actividades/actividades-consulta.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearActividad() {
  return {
    id_actividad: '40000000-0000-4000-8000-000000000004',
    id_proyecto: ID_PROYECTO,
    id_actor: ID_USUARIO,
    tipo_accion: 'PROYECTO_CREADO',
    mensaje: 'Proyecto creado.',
    fecha_creacion: new Date('2026-09-10T15:30:00.000Z'),
  };
}

/**
 * Representa la fila que produce el LEFT JOIN cuando no hay
 * actividades en la página solicitada, pero el proyecto está disponible.
 */
function crearPaginaVacia(total) {
  return {
    id_actividad: null,
    id_proyecto: null,
    id_actor: null,
    tipo_accion: null,
    mensaje: null,
    fecha_creacion: null,
    total,
  };
}

/**
 * Simula las respuestas de DatabaseService.
 *
 * No ejecuta SQL: las reglas de acceso y el orden se comprobarán
 * posteriormente con PostgreSQL real.
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
    repositorio: new ActividadesConsultaRepository(database),
    consultas,
  };
}

test(
  'findDisponiblesPaginadas: parametriza la consulta y separa el total de las actividades',
  async () => {
    const actividad = crearActividad();

    const { repositorio, consultas } = crearEscenario({
      filas: [{ ...actividad, total: '45' }],
    });

    const resultado = await repositorio.findDisponiblesPaginadas(
      ID_PROYECTO,
      ID_USUARIO,
      3,
      20,
    );

    assert.deepEqual(resultado, {
      actividades: [actividad],
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
      Object.hasOwn(resultado.actividades[0], 'total'),
      false,
    );
  },
);

test(
  'findDisponiblesPaginadas: devuelve null cuando el proyecto no está disponible',
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
  'findDisponiblesPaginadas: devuelve un historial vacío para un proyecto disponible sin actividades',
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
      actividades: [],
      total: 0,
    });

    assert.equal(consultas[0].parametros[3], 0);
  },
);

test(
  'findDisponiblesPaginadas: conserva el total cuando la página solicitada está vacía',
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
      actividades: [],
      total: 45,
    });
  },
);

test(
  'findDisponiblesPaginadas: rechaza un conteo superior al entero seguro de JavaScript',
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
          'El total de actividades no puede representarse correctamente.',
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
    `findDisponiblesPaginadas: rechaza un conteo ${descripcion}`,
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
            'El conteo de actividades tiene un formato inesperado.',
        },
      );
    },
  );
}

test(
  'findDisponiblesPaginadas: propaga el error original de la base de datos',
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