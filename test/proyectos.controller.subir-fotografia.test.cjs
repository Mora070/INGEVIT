require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  ProyectosController,
} = require('../dist/modules/proyectos/proyectos.controller');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Aísla el método HTTP del servicio de subida.
 *
 * Los otros servicios no participan en esta operación.
 * Las pruebas HTTP posteriores comprobarán guards, pipes,
 * validación del formulario e interceptor multipart.
 */
function crearControlador(subir) {
  return new ProyectosController(
    {},
    {},
    {},
    { subir },
  );
}

test(
  'subirFotografia: entrega proyecto, identidad, datos y Buffer al servicio',
  async () => {
    const datos = { titulo: 'Avance de obra' };
    const contenido = Buffer.from([10, 20, 30]);

    const respuestaEsperada = {
      id_fotografia: '30000000-0000-4000-8000-000000000003',
      id_proyecto: ID_PROYECTO,
      id_usuario_subida: ID_USUARIO,
      titulo: datos.titulo,
      url: '/api/proyectos/ejemplo/fotografias/archivos/ejemplo.webp',
      fecha_subida: '2026-09-11T12:00:00.000Z',
    };

    let llamadas = 0;

    const controlador = crearControlador(
      async (idProyecto, idUsuario, datosRecibidos, bufferRecibido) => {
        llamadas += 1;

        assert.equal(idProyecto, ID_PROYECTO);
        assert.equal(idUsuario, ID_USUARIO);
        assert.strictEqual(datosRecibidos, datos);
        assert.strictEqual(bufferRecibido, contenido);

        return respuestaEsperada;
      },
    );

    const resultado = await controlador.subirFotografia(
      ID_PROYECTO,
      { usuario: { id_usuario: ID_USUARIO } },
      datos,
      contenido,
    );

    assert.equal(llamadas, 1);
    assert.strictEqual(resultado, respuestaEsperada);
  },
);

test(
  'subirFotografia: rechaza una petición sin identidad y no llama al servicio',
  async () => {
    let llamadas = 0;

    const controlador = crearControlador(async () => {
      llamadas += 1;
    });

    await assert.rejects(
      () =>
        controlador.subirFotografia(
          ID_PROYECTO,
          {},
          { titulo: 'Avance de obra' },
          Buffer.from([1]),
        ),
      (error) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.equal(error.getStatus(), 401);
        assert.equal(
          error.message,
          'La sesión no es válida o ha expirado.',
        );

        return true;
      },
    );

    assert.equal(llamadas, 0);
  },
);

test(
  'subirFotografia: utiliza la sesión aunque el cuerpo contenga otra identidad',
  async () => {
    let identidadRecibida;

    const controlador = crearControlador(
      async (_idProyecto, idUsuario) => {
        identidadRecibida = idUsuario;
        return {};
      },
    );

    /*
     * Invocamos el método directamente, sin ValidationPipe.
     * En HTTP, el campo adicional debe rechazarse.
     *
     * Aquí comprobamos que el argumento de identidad enviado
     * al servicio se obtiene exclusivamente de request.usuario.
     */
    await controlador.subirFotografia(
      ID_PROYECTO,
      { usuario: { id_usuario: ID_USUARIO } },
      {
        titulo: 'Avance de obra',
        id_usuario_subida: '40000000-0000-4000-8000-000000000004',
      },
      Buffer.from([1]),
    );

    assert.equal(identidadRecibida, ID_USUARIO);
  },
);

test(
  'subirFotografia: conserva el error de proyecto no disponible',
  async () => {
    const errorEsperado = new NotFoundException(
      'El proyecto no está disponible.',
    );

    const controlador = crearControlador(async () => {
      throw errorEsperado;
    });

    await assert.rejects(
      () =>
        controlador.subirFotografia(
          ID_PROYECTO,
          { usuario: { id_usuario: ID_USUARIO } },
          { titulo: 'Avance de obra' },
          Buffer.from([1]),
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        assert.equal(error.getStatus(), 404);
        return true;
      },
    );
  },
);

test(
  'subirFotografia: propaga un fallo del servicio sin devolver un resultado exitoso',
  async () => {
    const errorEsperado = new Error('Fallo simulado de persistencia');

    const controlador = crearControlador(async () => {
      throw errorEsperado;
    });

    await assert.rejects(
      () =>
        controlador.subirFotografia(
          ID_PROYECTO,
          { usuario: { id_usuario: ID_USUARIO } },
          { titulo: 'Avance de obra' },
          Buffer.from([1]),
        ),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);