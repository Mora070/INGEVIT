require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_ACTOR = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Simula las dependencias del servicio y registra el orden de ejecución.
 *
 * No ejecuta SQL ni realiza un rollback real. La atomicidad en PostgreSQL
 * se verificará posteriormente mediante una prueba de integración.
 */
function crearEscenario({
  actorActivo = true,
  proyectoDisponible = true,
  relacionRetirada = true,
  errorRetirada,
  errorActividad,
  errorConfirmacion,
} = {}) {
  const client = {};
  const operaciones = [];

  const repositorio = {
    async bloquearPropietarioActivo(cliente, idActor) {
      assert.strictEqual(cliente, client);

      operaciones.push({
        tipo: 'actor',
        idActor,
      });

      return actorActivo;
    },

    async bloquearEditablePorPropietario(
      cliente,
      idProyecto,
      idActor,
    ) {
      assert.strictEqual(cliente, client);

      operaciones.push({
        tipo: 'proyecto',
        idProyecto,
        idActor,
      });

      return proyectoDisponible
        ? { id_proyecto: idProyecto, id_propietario: idActor }
        : null;
    },

    async retirarColaborador(
      cliente,
      idProyecto,
      idColaborador,
    ) {
      assert.strictEqual(cliente, client);

      operaciones.push({
        tipo: 'retirada',
        idProyecto,
        idColaborador,
      });

      if (errorRetirada) {
        throw errorRetirada;
      }

      return relacionRetirada;
    },
  };

  const actividades = {
    async crear(cliente, datos) {
      assert.strictEqual(cliente, client);

      operaciones.push({
        tipo: 'actividad',
        datos,
      });

      if (errorActividad) {
        throw errorActividad;
      }
    },
  };

  const database = {
    async withTransaction(operacion) {
      operaciones.push({ tipo: 'inicio' });

      const resultado = await operacion(client);

      operaciones.push({ tipo: 'confirmacion' });

      if (errorConfirmacion) {
        throw errorConfirmacion;
      }

      return resultado;
    },
  };

  return {
    servicio: new ProyectosService(
      repositorio,
      database,
      actividades,
    ),
    operaciones,
  };
}

test(
  'retirarColaborador: comprueba al propietario y registra la retirada en la misma transacción',
  async () => {
    const { servicio, operaciones } = crearEscenario();

    const resultado = await servicio.retirarColaborador(
      ID_PROYECTO,
      ID_ACTOR,
      ID_COLABORADOR,
    );

    assert.equal(resultado, undefined);

    assert.deepEqual(operaciones, [
      { tipo: 'inicio' },
      {
        tipo: 'actor',
        idActor: ID_ACTOR,
      },
      {
        tipo: 'proyecto',
        idProyecto: ID_PROYECTO,
        idActor: ID_ACTOR,
      },
      {
        tipo: 'retirada',
        idProyecto: ID_PROYECTO,
        idColaborador: ID_COLABORADOR,
      },
      {
        tipo: 'actividad',
        datos: {
          idProyecto: ID_PROYECTO,
          idActor: ID_ACTOR,
          tipoAccion: 'COLABORADOR_RETIRADO',
          mensaje:
            `Usuario ${ID_COLABORADOR} retirado como colaborador.`,
        },
      },
      { tipo: 'confirmacion' },
    ]);
  },
);

test(
  'retirarColaborador: rechaza un actor inactivo antes de consultar el proyecto',
  async () => {
    const { servicio, operaciones } = crearEscenario({
      actorActivo: false,
    });

    await assert.rejects(
      servicio.retirarColaborador(
        ID_PROYECTO,
        ID_ACTOR,
        ID_COLABORADOR,
      ),
      (error) => {
        assert.equal(error.getStatus(), 401);
        assert.equal(
          error.message,
          'La sesión no es válida o la cuenta no está activa.',
        );

        return true;
      },
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['inicio', 'actor'],
    );
  },
);

test(
  'retirarColaborador: no elimina relaciones cuando el proyecto no está disponible para el propietario',
  async () => {
    const { servicio, operaciones } = crearEscenario({
      proyectoDisponible: false,
    });

    await assert.rejects(
      servicio.retirarColaborador(
        ID_PROYECTO,
        ID_ACTOR,
        ID_COLABORADOR,
      ),
      (error) => {
        assert.equal(error.getStatus(), 404);
        assert.equal(
          error.message,
          'El proyecto no está disponible para gestionar colaboradores.',
        );

        return true;
      },
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['inicio', 'actor', 'proyecto'],
    );
  },
);

test(
  'retirarColaborador: termina sin actividad cuando la relación no existe',
  async () => {
    const { servicio, operaciones } = crearEscenario({
      relacionRetirada: false,
    });

    const resultado = await servicio.retirarColaborador(
      ID_PROYECTO,
      ID_ACTOR,
      ID_COLABORADOR,
    );

    assert.equal(resultado, undefined);

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['inicio', 'actor', 'proyecto', 'retirada', 'confirmacion'],
    );
  },
);

test(
  'retirarColaborador: propaga el error de eliminación sin registrar actividad',
  async () => {
    const errorEsperado = new Error('Fallo al retirar la relación');

    const { servicio, operaciones } = crearEscenario({
      errorRetirada: errorEsperado,
    });

    await assert.rejects(
      servicio.retirarColaborador(
        ID_PROYECTO,
        ID_ACTOR,
        ID_COLABORADOR,
      ),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['inicio', 'actor', 'proyecto', 'retirada'],
    );
  },
);

test(
  'retirarColaborador: propaga el error del historial para que la transacción pueda revertirse',
  async () => {
    const errorEsperado = new Error('Fallo al registrar la actividad');

    const { servicio, operaciones } = crearEscenario({
      errorActividad: errorEsperado,
    });

    await assert.rejects(
      servicio.retirarColaborador(
        ID_PROYECTO,
        ID_ACTOR,
        ID_COLABORADOR,
      ),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(
      operaciones.map((operacion) => operacion.tipo),
      ['inicio', 'actor', 'proyecto', 'retirada', 'actividad'],
    );
  },
);

test(
  'retirarColaborador: no comunica éxito cuando falla la confirmación de la transacción',
  async () => {
    const errorEsperado = new Error('Fallo al confirmar la transacción');

    const { servicio, operaciones } = crearEscenario({
      errorConfirmacion: errorEsperado,
    });

    await assert.rejects(
      servicio.retirarColaborador(
        ID_PROYECTO,
        ID_ACTOR,
        ID_COLABORADOR,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(operaciones.at(-1).tipo, 'confirmacion');
  },
);