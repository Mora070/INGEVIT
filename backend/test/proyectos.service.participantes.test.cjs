require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_SOLICITANTE = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Simula únicamente la consulta utilizada por listarParticipantes.
 *
 * Este método no necesita abrir una transacción ni registrar actividades.
 * Los dobles correspondientes fallan si se utilizan accidentalmente.
 */
function crearEscenario({ filas = [], errorConsulta } = {}) {
  const consultas = [];

  const repositorio = {
    async findParticipantesDisponibles(idProyecto, idUsuario) {
      consultas.push({ idProyecto, idUsuario });

      if (errorConsulta) {
        throw errorConsulta;
      }

      return filas;
    },
  };

  const database = {
    async withTransaction() {
      assert.fail('La consulta no debe abrir una transacción explícita.');
    },
  };

  const actividades = {
    async crear() {
      assert.fail('Consultar participantes no debe registrar una actividad.');
    },
  };

  return {
    servicio: new ProyectosService(
      repositorio,
      database,
      actividades,
    ),
    consultas,
  };
}

test(
  'listarParticipantes: consulta los identificadores recibidos y devuelve campos públicos',
  async () => {
    const filas = [
      {
        id_usuario: ID_SOLICITANTE,
        nombre: 'Nombre propietario',
        apellidos: 'Apellido propietario',
        foto_perfil_url: null,
        participacion: 'PROPIETARIO',
        password_hash: 'HASH_FICTICIO_NO_PUBLICABLE',
        google_sub: 'IDENTIFICADOR_FICTICIO_NO_PUBLICABLE',
      },
      {
        id_usuario: ID_COLABORADOR,
        nombre: 'Nombre colaborador',
        apellidos: 'Apellido colaborador',
        foto_perfil_url: null,
        participacion: 'COLABORADOR',
        correo: 'prueba@example.invalid',
      },
    ];

    const { servicio, consultas } = crearEscenario({ filas });

    const resultado = await servicio.listarParticipantes(
      ID_PROYECTO,
      ID_SOLICITANTE,
    );

    assert.deepEqual(consultas, [
      {
        idProyecto: ID_PROYECTO,
        idUsuario: ID_SOLICITANTE,
      },
    ]);

    assert.deepEqual(resultado, [
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
    ]);
  },
);

test(
  'listarParticipantes: responde 404 cuando el repositorio devuelve un arreglo vacío',
  async () => {
    const { servicio, consultas } = crearEscenario();

    await assert.rejects(
      servicio.listarParticipantes(
        ID_PROYECTO,
        ID_SOLICITANTE,
      ),
      (error) => {
        assert.equal(error.getStatus(), 404);
        assert.equal(
          error.message,
          'El proyecto no está disponible.',
        );

        return true;
      },
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'listarParticipantes: propaga el error del repositorio sin convertirlo en 404',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const { servicio, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      servicio.listarParticipantes(
        ID_PROYECTO,
        ID_SOLICITANTE,
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'listarParticipantes: admite un proyecto con solo su propietario y perfil incompleto',
  async () => {
    const propietario = {
      id_usuario: ID_SOLICITANTE,
      nombre: null,
      apellidos: null,
      foto_perfil_url: null,
      participacion: 'PROPIETARIO',
    };

    const { servicio } = crearEscenario({
      filas: [propietario],
    });

    const resultado = await servicio.listarParticipantes(
      ID_PROYECTO,
      ID_SOLICITANTE,
    );

    assert.deepEqual(resultado, [propietario]);
    assert.notStrictEqual(resultado[0], propietario);
  },
);