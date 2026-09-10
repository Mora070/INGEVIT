require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';

function crearEntrada(cambios = {}) {
  return {
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    estado_proyecto: 'ACTIVA',
    ...cambios,
  };
}

function crearFila(cambios = {}) {
  return {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: null,
    longitud: null,
    ...cambios,
  };
}

/**
 * Simula las dependencias para comprobar la coordinación.
 *
 * Este escenario no ejecuta BEGIN, COMMIT ni ROLLBACK reales.
 * La atomicidad se comprobará después con PostgreSQL.
 */
function crearEscenario({
  propietarioActivo = true,
  errorBloqueo,
  errorProyecto,
  errorActividad,
  errorConfirmacion,
} = {}) {
  const client = {};
  const operaciones = [];

  const proyectosRepository = {
    async bloquearPropietarioActivo(cliente, idUsuario) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'propietario', idUsuario });

      if (errorBloqueo) {
        throw errorBloqueo;
      }

      return propietarioActivo;
    },

    async crear(cliente, datos) {
      assert.strictEqual(cliente, client);
      operaciones.push({ tipo: 'proyecto', datos });

      if (errorProyecto) {
        throw errorProyecto;
      }

      return crearFila({
        fecha_finalizacion: datos.fechaFinalizacion,
        latitud:
          datos.latitud === null ? null : String(datos.latitud),
        longitud:
          datos.longitud === null ? null : String(datos.longitud),
      });
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
      proyectosRepository,
      database,
      actividadesRepository,
    ),
    operaciones,
  };
}

test('crear proyecto: coordina propietario, proyecto e historial dentro de la transacción', async () => {
  const { service, operaciones } = crearEscenario();

  const resultado = await service.crear(
    ID_USUARIO,
    crearEntrada(),
  );

  assert.deepEqual(operaciones, [
    { tipo: 'inicio' },
    {
      tipo: 'propietario',
      idUsuario: ID_USUARIO,
    },
    {
      tipo: 'proyecto',
      datos: {
        idPropietario: ID_USUARIO,
        nombre: 'Proyecto de prueba',
        descripcion: 'Descripción de prueba',
        direccion: 'Dirección de prueba',
        contratante: 'Cliente de prueba',
        fechaInicio: '2026-09-09',
        fechaFinalizacion: null,
        estadoProyecto: 'ACTIVA',
        latitud: null,
        longitud: null,
      },
    },
    {
      tipo: 'actividad',
      datos: {
        idProyecto: ID_PROYECTO,
        idActor: ID_USUARIO,
        tipoAccion: 'PROYECTO_CREADO',
        mensaje: 'Proyecto creado.',
      },
    },
    { tipo: 'confirmacion' },
  ]);

  assert.deepEqual(resultado, crearFila());
});

test('crear proyecto: conserva los campos opcionales y las coordenadas iguales a cero', async () => {
  const { service, operaciones } = crearEscenario();

  const resultado = await service.crear(
    ID_USUARIO,
    crearEntrada({
      fecha_finalizacion: '2026-12-31',
      latitud: 0,
      longitud: -74.0721,
    }),
  );

  const insercion = operaciones.find(
    (operacion) => operacion.tipo === 'proyecto',
  );

  assert.equal(insercion.datos.fechaFinalizacion, '2026-12-31');
  assert.equal(insercion.datos.latitud, 0);
  assert.equal(insercion.datos.longitud, -74.0721);

  assert.equal(resultado.latitud, 0);
  assert.equal(resultado.longitud, -74.0721);
});

test('crear proyecto: ignora un propietario o actor adicional enviado en los datos', async () => {
  const { service, operaciones } = crearEscenario();

  await service.crear(
    ID_USUARIO,
    crearEntrada({
      id_propietario: '30000000-0000-4000-8000-000000000003',
      id_actor: '40000000-0000-4000-8000-000000000004',
      activo: false,
    }),
  );

  const proyecto = operaciones.find(
    (operacion) => operacion.tipo === 'proyecto',
  );
  const actividad = operaciones.find(
    (operacion) => operacion.tipo === 'actividad',
  );

  assert.equal(proyecto.datos.idPropietario, ID_USUARIO);
  assert.equal(actividad.datos.idActor, ID_USUARIO);
  assert.equal(Object.hasOwn(proyecto.datos, 'activo'), false);
});

test('crear proyecto: no inserta datos cuando el propietario no está disponible', async () => {
  const { service, operaciones } = crearEscenario({
    propietarioActivo: false,
  });

  await assert.rejects(
    () => service.crear(ID_USUARIO, crearEntrada()),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
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
    ['inicio', 'propietario'],
  );
});

test('crear proyecto: propaga un fallo al comprobar el propietario', async () => {
  const errorOriginal = new Error('Fallo simulado del bloqueo');

  const { service, operaciones } = crearEscenario({
    errorBloqueo: errorOriginal,
  });

  await assert.rejects(
    () => service.crear(ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario'],
  );
});

test('crear proyecto: no registra una actividad si falla la inserción del proyecto', async () => {
  const errorOriginal = new Error('Fallo simulado del proyecto');

  const { service, operaciones } = crearEscenario({
    errorProyecto: errorOriginal,
  });

  await assert.rejects(
    () => service.crear(ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario', 'proyecto'],
  );
});

test('crear proyecto: propaga el fallo de la actividad sin alcanzar la confirmación', async () => {
  const errorOriginal = new Error('Fallo simulado del historial');

  const { service, operaciones } = crearEscenario({
    errorActividad: errorOriginal,
  });

  await assert.rejects(
    () => service.crear(ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(
    operaciones.map((operacion) => operacion.tipo),
    ['inicio', 'propietario', 'proyecto', 'actividad'],
  );
});

test('crear proyecto: no devuelve éxito si falla la confirmación de la transacción', async () => {
  const errorOriginal = new Error('Fallo simulado de confirmación');

  const { service } = crearEscenario({
    errorConfirmacion: errorOriginal,
  });

  await assert.rejects(
    () => service.crear(ID_USUARIO, crearEntrada()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});