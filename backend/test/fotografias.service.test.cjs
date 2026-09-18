require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasService,
} = require('../dist/modules/fotografias/fotografias.service');

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
 * Simula el repositorio para comprobar la coordinación del servicio.
 *
 * No ejecuta SQL ni accede a archivos. Los permisos y la consulta
 * ya tienen pruebas de integración independientes.
 */
function crearEscenario({
  resultado = { fotografias: [], total: 0 },
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
    servicio: new FotografiasService(repositorio),
    consultas,
  };
}

test(
  'FotografiasService: consulta los parámetros recibidos y construye la respuesta pública',
  async () => {
    const fotografia = {
      ...crearFotografia(),
      dato_interno: 'NO_PUBLICABLE',
    };

    const { servicio, consultas } = crearEscenario({
      resultado: {
        fotografias: [fotografia],
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
      fotografias: [
        {
          id_fotografia: fotografia.id_fotografia,
          id_proyecto: ID_PROYECTO,
          id_usuario_subida: ID_USUARIO,
          titulo: 'Fotografía de prueba',
          url: 'https://example.invalid/fotografia.jpg',
          fecha_subida: '2026-09-10T15:30:00.000Z',
        },
      ],
      pagina: 3,
      limite: 20,
      total: 45,
      total_paginas: 3,
    });

    // El registro interno conserva su clave y su fecha original.
    assert.equal(
      fotografia.s3_key,
      'fotografias/archivo-de-prueba.jpg',
    );
    assert.ok(fotografia.fecha_subida instanceof Date);
  },
);

test(
  'FotografiasService: devuelve cero páginas cuando no hay fotografías',
  async () => {
    const { servicio } = crearEscenario();

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 1, limite: 20 },
    );

    assert.deepEqual(respuesta, {
      fotografias: [],
      pagina: 1,
      limite: 20,
      total: 0,
      total_paginas: 0,
    });
  },
);

test(
  'FotografiasService: conserva el total cuando la página solicitada está vacía',
  async () => {
    const { servicio } = crearEscenario({
      resultado: {
        fotografias: [],
        total: 45,
      },
    });

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 4, limite: 20 },
    );

    assert.deepEqual(respuesta, {
      fotografias: [],
      pagina: 4,
      limite: 20,
      total: 45,
      total_paginas: 3,
    });
  },
);

test(
  'FotografiasService: no agrega una página cuando el total es múltiplo del límite',
  async () => {
    const { servicio } = crearEscenario({
      resultado: {
        fotografias: [],
        total: 40,
      },
    });

    const respuesta = await servicio.listarDisponibles(
      ID_PROYECTO,
      ID_USUARIO,
      { pagina: 3, limite: 20 },
    );

    assert.equal(respuesta.total, 40);
    assert.equal(respuesta.total_paginas, 2);
  },
);

test(
  'FotografiasService: responde 404 cuando el proyecto no está disponible',
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
  'FotografiasService: propaga el error del repositorio sin convertirlo en 404',
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