require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '30000000-0000-4000-8000-000000000003';

/**
 * Simula el cliente de una transacción y registra sus consultas.
 *
 * La conexión general falla si se utiliza accidentalmente:
 * esta operación debe participar en la transacción del servicio.
 */
function crearEscenario({ rowCount = 1, errorConsulta } = {}) {
  const consultas = [];

  const database = {
    async query() {
      assert.fail(
        'La operación debe utilizar el cliente de la transacción.',
      );
    },
  };

  const client = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros });

      if (errorConsulta) {
        throw errorConsulta;
      }

      return {
        rowCount,
        rows: [],
      };
    },
  };

  return {
    repositorio: new ProyectosRepository(database),
    client,
    consultas,
  };
}

test(
  'retirarColaborador: elimina únicamente la relación indicada usando la transacción',
  async () => {
    const { repositorio, client, consultas } = crearEscenario();

    const resultado = await repositorio.retirarColaborador(
      client,
      ID_PROYECTO,
      ID_USUARIO,
    );

    assert.equal(resultado, true);
    assert.equal(consultas.length, 1);

    const consulta = consultas[0];

    // Normalizamos espacios para no depender del formato del código SQL.
    const sql = consulta.sql.replace(/\s+/g, ' ').trim();

    assert.match(
      sql,
      /^DELETE FROM obra\.usuario_proyecto WHERE id_usuario = \$1::uuid AND id_proyecto = \$2::uuid;?$/i,
    );

    assert.deepEqual(consulta.parametros, [
      ID_USUARIO,
      ID_PROYECTO,
    ]);
  },
);

test(
  'retirarColaborador: devuelve false cuando la relación no existe',
  async () => {
    const { repositorio, client, consultas } = crearEscenario({
      rowCount: 0,
    });

    const resultado = await repositorio.retirarColaborador(
      client,
      ID_PROYECTO,
      ID_USUARIO,
    );

    assert.equal(resultado, false);
    assert.equal(consultas.length, 1);
  },
);

test(
  'retirarColaborador: propaga el error original de PostgreSQL',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const { repositorio, client, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      repositorio.retirarColaborador(
        client,
        ID_PROYECTO,
        ID_USUARIO,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'retirarColaborador: rechaza un conteo inesperado de filas',
  async () => {
    const { repositorio, client } = crearEscenario({
      rowCount: 2,
    });

    await assert.rejects(
      repositorio.retirarColaborador(
        client,
        ID_PROYECTO,
        ID_USUARIO,
      ),
      {
        message:
          'La eliminación del colaborador devolvió un resultado inesperado.',
      },
    );
  },
);

test(
  'retirarColaborador: no interpreta un conteo nulo como una eliminación válida',
  async () => {
    const { repositorio, client } = crearEscenario({
      rowCount: null,
    });

    await assert.rejects(
      repositorio.retirarColaborador(
        client,
        ID_PROYECTO,
        ID_USUARIO,
      ),
      {
        message:
          'La eliminación del colaborador devolvió un resultado inesperado.',
      },
    );
  },
);