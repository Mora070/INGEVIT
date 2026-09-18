require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_SOLICITANTE = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Simula DatabaseService para comprobar cómo lo utiliza el repositorio.
 *
 * No ejecuta SQL. Las condiciones de acceso, el orden y la exclusión
 * de duplicados requieren pruebas de integración con PostgreSQL.
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
    repositorio: new ProyectosRepository(database),
    consultas,
  };
}

test(
  'findParticipantesDisponibles: parametriza proyecto y solicitante y devuelve los registros',
  async () => {
    const filas = [
      {
        id_usuario: ID_SOLICITANTE,
        nombre: 'Nombre propietario',
        apellidos: 'Apellido propietario',
        foto_perfil_url: null,
        participacion: 'PROPIETARIO',
      },
      {
        id_usuario: ID_COLABORADOR,
        nombre: 'Nombre colaborador',
        apellidos: 'Apellido colaborador',
        foto_perfil_url: null,
        participacion: 'COLABORADOR',
      },
    ];

    const { repositorio, consultas } = crearEscenario({ filas });

    const resultado =
      await repositorio.findParticipantesDisponibles(
        ID_PROYECTO,
        ID_SOLICITANTE,
      );

    assert.deepEqual(resultado, filas);
    assert.equal(consultas.length, 1);

    const consulta = consultas[0];

    assert.deepEqual(consulta.parametros, [
      ID_PROYECTO,
      ID_SOLICITANTE,
    ]);

    // Los valores se envían separados del texto SQL.
    assert.equal(consulta.sql.includes(ID_PROYECTO), false);
    assert.equal(consulta.sql.includes(ID_SOLICITANTE), false);
    assert.match(consulta.sql, /\$1::uuid/);
    assert.match(consulta.sql, /\$2::uuid/);
  },
);

test(
  'findParticipantesDisponibles: devuelve un arreglo vacío cuando la consulta no encuentra participantes',
  async () => {
    const { repositorio, consultas } = crearEscenario();

    const resultado =
      await repositorio.findParticipantesDisponibles(
        ID_PROYECTO,
        ID_SOLICITANTE,
      );

    assert.deepEqual(resultado, []);
    assert.equal(consultas.length, 1);
  },
);

test(
  'findParticipantesDisponibles: propaga el error original de la base de datos',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const { repositorio, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      repositorio.findParticipantesDisponibles(
        ID_PROYECTO,
        ID_SOLICITANTE,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'findParticipantesDisponibles: mantiene una entrada maliciosa fuera del texto SQL',
  async () => {
    const entradaMaliciosa = "' OR true --";
    const { repositorio, consultas } = crearEscenario();

    await repositorio.findParticipantesDisponibles(
      entradaMaliciosa,
      ID_SOLICITANTE,
    );

    assert.equal(consultas.length, 1);
    assert.equal(
      consultas[0].sql.includes(entradaMaliciosa),
      false,
    );

    assert.deepEqual(consultas[0].parametros, [
      entradaMaliciosa,
      ID_SOLICITANTE,
    ]);
  },
);