require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_PROYECTO = '10000000-0000-4000-8000-000000000001';
const ID_PROPIETARIO = '20000000-0000-4000-8000-000000000002';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Comprueba la coordinación utilizando un cliente compartido.
 * No ejecuta transacciones ni inserciones reales.
 */
function crearEscenario({
  propietarioActivo = true,
  proyectoDisponible = true,
  usuarioExiste = true,
  agregado = true,
  errorInsercion,
  errorActividad,
  errorConfirmacion,
} = {}) {
  const client = {};
  const operaciones = [];

  const repository = {
    async bloquearPropietarioActivo(cliente, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'propietario', idUsuario });
      return propietarioActivo;
    },

    async bloquearEditablePorPropietario(
      cliente,
      idProyecto,
      idUsuario,
    ) {
      assert.strictEqual(cliente, client);
      operaciones.push({
        tipo: 'proyecto',
        idProyecto,
        idUsuario,
      });

      return proyectoDisponible
        ? { id_proyecto: ID_PROYECTO }
        : null;
    },

    async bloquearUsuarioExistente(cliente, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'destinatario', idUsuario });
      return usuarioExiste;
    },

    async agregarColaborador(cliente, idProyecto, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({
        tipo: 'agregar',
        idProyecto,
        idUsuario,
      });

      if (errorInsercion) {
        throw errorInsercion;
      }

      return agregado;
    },
  };

  const actividadesRepository = {
    async crear(cliente, datos) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'actividad', datos });

      if (errorActividad) {
        throw errorActividad;
      }
    },
  };

  const database = {
    async withTransaction(operation) {
      operaciones.push({ tipo: 'inicio' });

      const resultado = await operation(client);

      operaciones.push({ tipo: 'confirmacion' });

      if (errorConfirmacion) {
        throw errorConfirmacion;
      }

      return resultado;
    },
  };

  return {
    service: new ProyectosService(
      repository,
      database,
      actividadesRepository,
    ),
    operaciones,
  };
}

function agregar(service) {
  return service.agregarColaborador(
    ID_PROYECTO,
    ID_PROPIETARIO,
    ID_COLABORADOR,
  );
}

test('agregarColaborador: comprueba permisos, crea la relación y registra al actor correcto', async () => {
  const { service, operaciones } = crearEscenario();

  assert.equal(await agregar(service), undefined);

  assert.deepEqual(operaciones, [
    { tipo: 'inicio' },
    {
      tipo: 'propietario',
      idUsuario: ID_PROPIETARIO,
    },
    {
      tipo: 'proyecto',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_PROPIETARIO,
    },
    {
      tipo: 'destinatario',
      idUsuario: ID_COLABORADOR,
    },
    {
      tipo: 'agregar',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_COLABORADOR,
    },
    {
      tipo: 'actividad',
      datos: {
        idProyecto: ID_PROYECTO,
        idActor: ID_PROPIETARIO,
        tipoAccion: 'COLABORADOR_AGREGADO',
        mensaje:
          `Usuario ${ID_COLABORADOR} agregado como colaborador.`,
      },
    },
    { tipo: 'confirmacion' },
  ]);
});

test('agregarColaborador: rechaza una cuenta solicitante inactiva', async () => {
  const { service, operaciones } = crearEscenario({
    propietarioActivo: false,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.equal(error.getStatus(), 401);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario'],
  );
});

test('agregarColaborador: no consulta al destinatario si el proyecto no es administrable por el solicitante', async () => {
  const { service, operaciones } = crearEscenario({
    proyectoDisponible: false,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.ok(error instanceof NotFoundException);
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
    ['inicio', 'propietario', 'proyecto'],
  );
});

test('agregarColaborador: rechaza un destinatario inexistente sin insertar', async () => {
  const { service, operaciones } = crearEscenario({
    usuarioExiste: false,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(
        error.message,
        'El usuario que deseas agregar no existe.',
      );
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario', 'proyecto', 'destinatario'],
  );
});

test('agregarColaborador: una relación existente no genera otra actividad', async () => {
  const { service, operaciones } = crearEscenario({
    agregado: false,
  });

  assert.equal(await agregar(service), undefined);

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    [
      'inicio',
      'propietario',
      'proyecto',
      'destinatario',
      'agregar',
      'confirmacion',
    ],
  );
});

test('agregarColaborador: no registra historial si falla la inserción', async () => {
  const errorOriginal = new Error('Fallo simulado de inserción');

  const { service, operaciones } = crearEscenario({
    errorInsercion: errorOriginal,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario', 'proyecto', 'destinatario', 'agregar'],
  );
});

test('agregarColaborador: propaga el fallo del historial sin confirmar', async () => {
  const errorOriginal = new Error('Fallo simulado de actividad');

  const { service, operaciones } = crearEscenario({
    errorActividad: errorOriginal,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    [
      'inicio',
      'propietario',
      'proyecto',
      'destinatario',
      'agregar',
      'actividad',
    ],
  );
});

test('agregarColaborador: no devuelve éxito si falla la confirmación', async () => {
  const errorOriginal = new Error('Fallo simulado de confirmación');

  const { service } = crearEscenario({
    errorConfirmacion: errorOriginal,
  });

  await assert.rejects(
    () => agregar(service),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});