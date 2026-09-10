require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';

function crearRepositorio() {
  return new ProyectosRepository({
    async query() {
      throw new Error('Debe utilizarse el cliente transaccional.');
    },
  });
}

test('eliminarLogicamente: actualiza únicamente activo utilizando parámetros', async () => {
  const llamadas = [];

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rowCount: 1 };
    },
  };

  await crearRepositorio().eliminarLogicamente(
    client,
    ID_PROYECTO,
    ID_USUARIO,
  );

  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [
    ID_PROYECTO,
    ID_USUARIO,
  ]);

  const sql = llamadas[0].sql;

  assert.match(
    sql,
    /UPDATE\s+obra\.proyectos\s+SET\s+activo\s*=\s*false\s+WHERE/i,
  );
  assert.match(sql, /id_proyecto\s*=\s*\$1::uuid/i);
  assert.match(sql, /id_propietario\s*=\s*\$2::uuid/i);
  assert.match(sql, /AND\s+activo\s*=\s*true/i);
  assert.doesNotMatch(sql, /\bDELETE\b/i);
  assert.equal(sql.includes(ID_PROYECTO), false);
});

test('eliminarLogicamente: exige exactamente una fila modificada', async () => {
  for (const rowCount of [0, null, 2]) {
    const client = {
      async query() {
        return { rowCount };
      },
    };

    await assert.rejects(
      () =>
        crearRepositorio().eliminarLogicamente(
          client,
          ID_PROYECTO,
          ID_USUARIO,
        ),
      {
        message:
          'No se pudo completar la eliminación lógica del proyecto.',
      },
    );
  }
});

test('eliminarLogicamente: propaga el error del cliente PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().eliminarLogicamente(
        client,
        ID_PROYECTO,
        ID_USUARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

/**
 * Simula la coordinación del servicio.
 * No ejecuta transacciones ni elimina datos reales.
 */
function crearEscenario({
  propietarioActivo = true,
  proyectoDisponible = true,
  errorEliminacion,
  errorActividad,
  errorConfirmacion,
} = {}) {
  const client = {};
  const operaciones = [];

  const repository = {
    async bloquearPropietarioActivo(cliente, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'cuenta', idUsuario });
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

    async eliminarLogicamente(cliente, idProyecto, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({
        tipo: 'eliminar',
        idProyecto,
        idUsuario,
      });

      if (errorEliminacion) {
        throw errorEliminacion;
      }
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

test('eliminación lógica: comprueba propiedad y registra la actividad antes de confirmar', async () => {
  const { service, operaciones } = crearEscenario();

  const resultado = await service.eliminarLogicamente(
    ID_PROYECTO,
    ID_USUARIO,
  );

  assert.equal(resultado, undefined);

  assert.deepEqual(operaciones, [
    { tipo: 'inicio' },
    { tipo: 'cuenta', idUsuario: ID_USUARIO },
    {
      tipo: 'proyecto',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_USUARIO,
    },
    {
      tipo: 'eliminar',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_USUARIO,
    },
    {
      tipo: 'actividad',
      datos: {
        idProyecto: ID_PROYECTO,
        idActor: ID_USUARIO,
        tipoAccion: 'PROYECTO_ELIMINADO_LOGICAMENTE',
        mensaje: 'Proyecto eliminado lógicamente.',
      },
    },
    { tipo: 'confirmacion' },
  ]);
});

test('eliminación lógica: rechaza una cuenta inactiva antes de consultar el proyecto', async () => {
  const { service, operaciones } = crearEscenario({
    propietarioActivo: false,
  });

  await assert.rejects(
    () => service.eliminarLogicamente(ID_PROYECTO, ID_USUARIO),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.equal(error.getStatus(), 401);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta'],
  );
});

test('eliminación lógica: no modifica un proyecto no disponible para el solicitante', async () => {
  const { service, operaciones } = crearEscenario({
    proyectoDisponible: false,
  });

  await assert.rejects(
    () => service.eliminarLogicamente(ID_PROYECTO, ID_USUARIO),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(
        error.message,
        'El proyecto no está disponible para eliminación.',
      );
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto'],
  );
});

test('eliminación lógica: no registra historial si falla la actualización', async () => {
  const errorOriginal = new Error('Fallo simulado al cambiar activo');

  const { service, operaciones } = crearEscenario({
    errorEliminacion: errorOriginal,
  });

  await assert.rejects(
    () => service.eliminarLogicamente(ID_PROYECTO, ID_USUARIO),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto', 'eliminar'],
  );
});

test('eliminación lógica: propaga el fallo del historial sin confirmar', async () => {
  const errorOriginal = new Error('Fallo simulado del historial');

  const { service, operaciones } = crearEscenario({
    errorActividad: errorOriginal,
  });

  await assert.rejects(
    () => service.eliminarLogicamente(ID_PROYECTO, ID_USUARIO),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto', 'eliminar', 'actividad'],
  );
});

test('eliminación lógica: no devuelve éxito si falla la confirmación', async () => {
  const errorOriginal = new Error('Fallo simulado de confirmación');

  const { service } = crearEscenario({
    errorConfirmacion: errorOriginal,
  });

  await assert.rejects(
    () => service.eliminarLogicamente(ID_PROYECTO, ID_USUARIO),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});