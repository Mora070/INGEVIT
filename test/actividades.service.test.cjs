require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ActividadesService,
} = require('../dist/modules/actividades/actividades.service');

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
 * Simula el resultado del repositorio.
 *
 * Las reglas de acceso y el SQL ya se comprueban por separado.
 * Aquí verificamos la coordinación y la respuesta del servicio.
 */
function crearEscenario({
  resultado = { actividades: [], total: 0 },
  errorConsulta,
} = {}) {
  const consultas = [];

  const repositorio = {
    async findDisponiblesPaginadas(
      idProyecto,
      idUsuario,
      pagina,
      limite,
    ) {
      consultas.push({
        idProyecto,
        idUsuario,
        pagina,
        limite,
      });

      if (errorConsulta) {
        throw errorConsulta;
      }

      return resultado;
    },
  };

  return {
    servicio: new ActividadesService(repositorio),
    consultas,
  };
}

test(
  'listarDisponibles: consulta los parámetros recibidos y construye la respuesta pública',
  async () => {
    const actividad = {
      ...crearActividad(),
      dato_interno: 'NO_PUBLICABLE',
    };

    const { servicio, consultas } = crearEscenario({
      resultado: {
        actividades: [actividad],
        total: 45,
      },
    });

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 3, limite: 20 },
    );

    assert.deepEqual(consultas, [
      {
        idProyecto: ID_PROYECTO,
        idUsuario: ID_USUARIO,
        pagina: 3,
        limite: 20,
      },
    ]);

    assert.deepEqual(respuesta, {
      actividades: [
        {
          id_actividad: actividad.id_actividad,
          id_proyecto: ID_PROYECTO,
          id_actor: ID_USUARIO,
          tipo_accion: 'PROYECTO_CREADO',
          mensaje: 'Proyecto creado.',
          fecha_creacion: '2026-09-10T15:30:00.000Z',
        },
      ],
      pagina: 3,
      limite: 20,
      total: 45,
      total_paginas: 3,
    });

    // El mapeo no debe sustituir la fecha del registro original.
    assert.ok(actividad.fecha_creacion instanceof Date);
  },
);

test(
  'listarDisponibles: devuelve cero páginas cuando el historial está vacío',
  async () => {
    const { servicio } = crearEscenario();

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 1, limite: 20 },
    );

    assert.deepEqual(respuesta, {
      actividades: [],
      pagina: 1,
      limite: 20,
      total: 0,
      total_paginas: 0,
    });
  },
);

test(
  'listarDisponibles: conserva el total y la página solicitada cuando no hay registros en esa página',
  async () => {
    const { servicio } = crearEscenario({
      resultado: {
        actividades: [],
        total: 45,
      },
    });

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 4, limite: 20 },
    );

    assert.deepEqual(respuesta, {
      actividades: [],
      pagina: 4,
      limite: 20,
      total: 45,
      total_paginas: 3,
    });
  },
);

test(
  'listarDisponibles: no agrega una página cuando el total es múltiplo del límite',
  async () => {
    const { servicio } = crearEscenario({
      resultado: {
        actividades: [],
        total: 40,
      },
    });

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 3, limite: 20 },
    );

    assert.equal(respuesta.total_paginas, 2);
    assert.equal(respuesta.total, 40);
  },
);

test(
  'listarDisponibles: responde 404 cuando el proyecto no está disponible',
  async () => {
    const { servicio, consultas } = crearEscenario({
      resultado: null,
    });

    await assert.rejects(
      servicio.listarDisponibles(
        ID_PROYECTO,
        ID_USUARIO,
        { pagina: 1, limite: 20 },
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
  'listarDisponibles: propaga el error del repositorio sin convertirlo en 404',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const { servicio, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      servicio.listarDisponibles(
        ID_PROYECTO,
        ID_USUARIO,
        { pagina: 1, limite: 20 },
      ),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);