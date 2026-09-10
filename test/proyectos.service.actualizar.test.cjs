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

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';

function crearEntrada(cambios = {}) {
  return {
    nombre: 'Proyecto actualizado',
    descripcion: 'Descripción actualizada',
    direccion: 'Dirección actualizada',
    contratante: 'Cliente actualizado',
    fecha_inicio: '2026-09-09',
    estado_proyecto: 'PAUSA',
    ...cambios,
  };
}

function crearFila() {
  return {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto anterior',
    descripcion: 'Descripción anterior',
    direccion: 'Dirección anterior',
    contratante: 'Cliente anterior',
    fecha_inicio: '2026-01-01',
    fecha_finalizacion: '2026-12-31',
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: '4.7110',
    longitud: '-74.0721',
  };
}

/**
 * Comprueba la coordinación con una conexión simulada compartida.
 * No ejecuta bloqueos ni transacciones reales de PostgreSQL.
 */
function crearEscenario({
  propietarioActivo = true,
  proyectoEditable = crearFila(),
  errorActualizacion,
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
      return proyectoEditable;
    },

    async actualizar(cliente, idProyecto, idUsuario, datos) {
      assert.strictEqual(cliente, client);
      operaciones.push({
        tipo: 'actualizar',
        idProyecto,
        idUsuario,
        datos,
      });

      if (errorActualizacion) {
        throw errorActualizacion;
      }

      return {
        ...crearFila(),
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        direccion: datos.direccion,
        contratante: datos.contratante,
        fecha_inicio: datos.fechaInicio,
        fecha_finalizacion: datos.fechaFinalizacion,
        estado_proyecto: datos.estadoProyecto,
        latitud:
          datos.latitud === null ? null : String(datos.latitud),
        longitud:
          datos.longitud === null ? null : String(datos.longitud),
      };
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

test('actualizar proyecto: bloquea en orden, actualiza y registra la actividad', async () => {
  const { service, operaciones } = crearEscenario();

  const resultado = await service.actualizar(
    ID_PROYECTO,
    ID_USUARIO,
    crearEntrada(),
  );

  assert.deepEqual(operaciones, [
    { tipo: 'inicio' },
    { tipo: 'cuenta', idUsuario: ID_USUARIO },
    {
      tipo: 'proyecto',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_USUARIO,
    },
    {
      tipo: 'actualizar',
      idProyecto: ID_PROYECTO,
      idUsuario: ID_USUARIO,
      datos: {
        nombre: 'Proyecto actualizado',
        descripcion: 'Descripción actualizada',
        direccion: 'Dirección actualizada',
        contratante: 'Cliente actualizado',
        fechaInicio: '2026-09-09',
        fechaFinalizacion: null,
        estadoProyecto: 'PAUSA',
        latitud: null,
        longitud: null,
      },
    },
    {
      tipo: 'actividad',
      datos: {
        idProyecto: ID_PROYECTO,
        idActor: ID_USUARIO,
        tipoAccion: 'PROYECTO_MODIFICADO',
        mensaje: 'Datos del proyecto actualizados.',
      },
    },
    { tipo: 'confirmacion' },
  ]);

  assert.deepEqual(resultado, {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto actualizado',
    descripcion: 'Descripción actualizada',
    direccion: 'Dirección actualizada',
    contratante: 'Cliente actualizado',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'PAUSA',
    activo: true,
    latitud: null,
    longitud: null,
  });
});

test('actualizar proyecto: conserva los opcionales proporcionados y las coordenadas cero', async () => {
  const { service, operaciones } = crearEscenario();

  const resultado = await service.actualizar(
    ID_PROYECTO,
    ID_USUARIO,
    crearEntrada({
      fecha_finalizacion: '2026-12-31',
      latitud: 0,
      longitud: 0,
    }),
  );

  const actualizacion = operaciones.find(
    (operacion) => operacion.tipo === 'actualizar',
  );

  assert.equal(
    actualizacion.datos.fechaFinalizacion,
    '2026-12-31',
  );
  assert.equal(actualizacion.datos.latitud, 0);
  assert.equal(actualizacion.datos.longitud, 0);
  assert.equal(resultado.latitud, 0);
  assert.equal(resultado.longitud, 0);
});

test('actualizar proyecto: no continúa cuando la cuenta está inactiva', async () => {
  const { service, operaciones } = crearEscenario({
    propietarioActivo: false,
  });

  await assert.rejects(
    () =>
      service.actualizar(ID_PROYECTO, ID_USUARIO, crearEntrada()),
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

test('actualizar proyecto: no escribe cuando el proyecto no es editable por el solicitante', async () => {
  const { service, operaciones } = crearEscenario({
    proyectoEditable: null,
  });

  await assert.rejects(
    () =>
      service.actualizar(ID_PROYECTO, ID_USUARIO, crearEntrada()),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(
        error.message,
        'El proyecto no está disponible para edición.',
      );
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto'],
  );
});

test('actualizar proyecto: excluye campos protegidos de la escritura', async () => {
  const { service, operaciones } = crearEscenario();

  await service.actualizar(
    ID_PROYECTO,
    ID_USUARIO,
    crearEntrada({
      id_propietario: '30000000-0000-4000-8000-000000000003',
      activo: false,
      id_actor: '40000000-0000-4000-8000-000000000004',
    }),
  );

  const actualizacion = operaciones.find(
    (operacion) => operacion.tipo === 'actualizar',
  );
  const actividad = operaciones.find(
    (operacion) => operacion.tipo === 'actividad',
  );

  assert.equal(actualizacion.idUsuario, ID_USUARIO);
  assert.equal(
    Object.hasOwn(actualizacion.datos, 'id_propietario'),
    false,
  );
  assert.equal(Object.hasOwn(actualizacion.datos, 'activo'), false);
  assert.equal(Object.hasOwn(actualizacion.datos, 'id_actor'), false);
  assert.equal(actividad.datos.idActor, ID_USUARIO);
});

test('actualizar proyecto: no registra historial si falla el UPDATE', async () => {
  const errorOriginal = new Error('Fallo simulado del UPDATE');

  const { service, operaciones } = crearEscenario({
    errorActualizacion: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.actualizar(ID_PROYECTO, ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto', 'actualizar'],
  );
});

test('actualizar proyecto: propaga el fallo del historial sin alcanzar la confirmación', async () => {
  const errorOriginal = new Error('Fallo simulado de la actividad');

  const { service, operaciones } = crearEscenario({
    errorActividad: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.actualizar(ID_PROYECTO, ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'cuenta', 'proyecto', 'actualizar', 'actividad'],
  );
});

test('actualizar proyecto: no devuelve éxito si falla la confirmación', async () => {
  const errorOriginal = new Error('Fallo simulado de confirmación');

  const { service } = crearEscenario({
    errorConfirmacion: errorOriginal,
  });

  await assert.rejects(
    () =>
      service.actualizar(ID_PROYECTO, ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});