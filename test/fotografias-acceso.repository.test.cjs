require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasAccesoRepository,
} = require(
  '../dist/modules/fotografias/fotografias-acceso.repository',
);

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_PROPIETARIO = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Devuelve respuestas en orden para cada consulta.
 *
 * Una consulta adicional inesperada hace fallar la prueba.
 * Este doble no simula los bloqueos reales de PostgreSQL.
 */
function crearEscenario(respuestas) {
  const consultas = [];

  const client = {
    async query(sql, parametros) {
      const indice = consultas.length;
      consultas.push({ sql, parametros });

      assert.ok(
        indice < respuestas.length,
        'El repositorio ejecutó una consulta inesperada.',
      );

      const respuesta = respuestas[indice];

      if (respuesta instanceof Error) {
        throw respuesta;
      }

      return {
        rows: respuesta,
        rowCount: respuesta.length,
      };
    },
  };

  return {
    repositorio: new FotografiasAccesoRepository(),
    client,
    consultas,
  };
}

test(
  'bloquearDisponible: permite al propietario sin consultar una colaboración',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [{ id_usuario: ID_PROPIETARIO }],
      [{ id_proyecto: ID_PROYECTO }],
    ]);

    const resultado = await repositorio.bloquearDisponible(
      client,
      ID_PROYECTO,
      ID_PROPIETARIO,
    );

    assert.equal(resultado, true);
    assert.equal(consultas.length, 3);

    assert.deepEqual(
      consultas.map((consulta) => consulta.parametros),
      [
        [ID_PROYECTO],
        [ID_PROPIETARIO, ID_PROPIETARIO],
        [ID_PROYECTO, ID_PROPIETARIO],
      ],
    );

    assert.match(consultas[1].sql, /FOR SHARE/i);
    assert.match(consultas[2].sql, /FOR SHARE/i);
  },
);

test(
  'bloquearDisponible: consulta la colaboración después de bloquear el proyecto',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [
        { id_usuario: ID_PROPIETARIO },
        { id_usuario: ID_COLABORADOR },
      ],
      [{ id_proyecto: ID_PROYECTO }],
      [{ existe: true }],
    ]);

    const resultado = await repositorio.bloquearDisponible(
      client,
      ID_PROYECTO,
      ID_COLABORADOR,
    );

    assert.equal(resultado, true);
    assert.equal(consultas.length, 4);

    assert.deepEqual(
      consultas.map((consulta) => consulta.parametros),
      [
        [ID_PROYECTO],
        [ID_PROPIETARIO, ID_COLABORADOR],
        [ID_PROYECTO, ID_PROPIETARIO],
        [ID_PROYECTO, ID_COLABORADOR],
      ],
    );

    assert.match(
      consultas[1].sql.replace(/\s+/g, ' '),
      /ORDER BY id_usuario FOR SHARE/i,
    );

    assert.match(consultas[2].sql, /FOR SHARE/i);
    assert.match(consultas[3].sql, /SELECT EXISTS/i);
    assert.match(consultas[3].sql, /obra\.usuario_proyecto/i);
  },
);

test(
  'bloquearDisponible: termina si el proyecto no existe',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [],
    ]);

    assert.equal(
      await repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_COLABORADOR,
      ),
      false,
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'bloquearDisponible: rechaza cuando falta uno de los usuarios activos',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [{ id_usuario: ID_PROPIETARIO }],
    ]);

    assert.equal(
      await repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_COLABORADOR,
      ),
      false,
    );

    assert.equal(consultas.length, 2);
  },
);

test(
  'bloquearDisponible: rechaza al propietario si no está activo',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [],
    ]);

    assert.equal(
      await repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_PROPIETARIO,
      ),
      false,
    );

    assert.equal(consultas.length, 2);
  },
);

test(
  'bloquearDisponible: rechaza si el proyecto deja de estar disponible al bloquearlo',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [
        { id_usuario: ID_PROPIETARIO },
        { id_usuario: ID_COLABORADOR },
      ],
      [],
    ]);

    assert.equal(
      await repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_COLABORADOR,
      ),
      false,
    );

    assert.equal(consultas.length, 3);
  },
);

test(
  'bloquearDisponible: rechaza al usuario sin relación de colaboración',
  async () => {
    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      [
        { id_usuario: ID_PROPIETARIO },
        { id_usuario: ID_COLABORADOR },
      ],
      [{ id_proyecto: ID_PROYECTO }],
      [{ existe: false }],
    ]);

    assert.equal(
      await repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_COLABORADOR,
      ),
      false,
    );

    assert.equal(consultas.length, 4);
  },
);

test(
  'bloquearDisponible: propaga un error de PostgreSQL sin convertirlo en acceso rechazado',
  async () => {
    const errorEsperado = new Error('Fallo de bloqueo simulado.');

    const { repositorio, client, consultas } = crearEscenario([
      [{ id_propietario: ID_PROPIETARIO }],
      errorEsperado,
    ]);

    await assert.rejects(
      repositorio.bloquearDisponible(
        client,
        ID_PROYECTO,
        ID_COLABORADOR,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 2);
  },
);