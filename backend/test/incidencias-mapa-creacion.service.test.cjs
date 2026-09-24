require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasMapaCreacionService,
} = require('../dist/modules/incidencias/incidencias-mapa-creacion.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const INCIDENCIA = '30000000-0000-4000-8000-000000000001';

const DATOS = {
  titulo: 'Fisura en el acceso',
  descripcion: 'Revisar el punto seleccionado.',
  prioridad: 'ALTA',
  latitud: 4.711,
  longitud: -74.0721,
};

function preparar({
  disponible = true,
  errorAcceso,
  errorInsercion,
  errorActividad,
  cambiosRegistro = {},
} = {}) {
  const client = {};
  const eventos = [];
  let insercion;
  let actividad;

  const servicio = new IncidenciasMapaCreacionService(
    {
      async withTransaction(operacion) {
        eventos.push('iniciar');

        const resultado = await operacion(client);

        eventos.push('confirmar');
        return resultado;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(usuario, USUARIO);
        eventos.push('autorizar');

        if (errorAcceso) throw errorAcceso;
        return disponible;
      },
    },
    {
      async crearEnMapa(conexion, datos) {
        assert.strictEqual(conexion, client);
        eventos.push('insertar');
        insercion = datos;

        if (errorInsercion) throw errorInsercion;

        return {
          id_incidencia: INCIDENCIA,
          ...datos,
          estado: 'PENDIENTE',
          id_plano: null,
          numero_pagina: null,
          coordenada_x: null,
          coordenada_y: null,
          latitud: String(datos.latitud),
          longitud: String(datos.longitud),
          fecha_creacion: new Date('2026-09-22T12:00:00.000Z'),
          ...cambiosRegistro,
        };
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        eventos.push('actividad');
        actividad = datos;

        if (errorActividad) throw errorActividad;
      },
    },
  );

  return {
    eventos,
    obtenerInsercion: () => insercion,
    obtenerActividad: () => actividad,
    ejecutar: (datos = DATOS) =>
      servicio.crear(PROYECTO, USUARIO, datos),
  };
}

test('crear incidencia de mapa: autoriza y registra antes de confirmar', async () => {
  const escenario = preparar();

  // Incluso una llamada interna no puede sustituir estos identificadores.
  const resultado = await escenario.ejecutar({
    ...DATOS,
    id_proyecto: 'proyecto-inyectado',
    id_creador: 'usuario-inyectado',
    estado: 'SOLUCIONADA',
  });

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'insertar', 'actividad', 'confirmar',
  ]);

  assert.deepEqual(escenario.obtenerInsercion(), {
    id_proyecto: PROYECTO,
    id_creador: USUARIO,
    ...DATOS,
  });

  assert.deepEqual(escenario.obtenerActividad(), {
    idProyecto: PROYECTO,
    idActor: USUARIO,
    tipoAccion: 'INCIDENCIA_CREADA',
    mensaje: `Incidencia ${INCIDENCIA} creada en el mapa.`,
  });

  assert.deepEqual(resultado, {
    id_incidencia: INCIDENCIA,
    id_proyecto: PROYECTO,
    id_creador: USUARIO,
    ...DATOS,
    estado: 'PENDIENTE',
    id_plano: null,
    numero_pagina: null,
    coordenada_x: null,
    coordenada_y: null,
    fecha_creacion: '2026-09-22T12:00:00.000Z',
  });
});

test('crear incidencia de mapa: rechaza proyectos no disponibles sin escribir', async () => {
  const escenario = preparar({ disponible: false });

  await assert.rejects(escenario.ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El proyecto no está disponible.');
    return true;
  });

  assert.deepEqual(escenario.eventos, ['iniciar', 'autorizar']);
});

test('crear incidencia de mapa: propaga fallos de autorización sin convertirlos en 404', async () => {
  const original = new Error('Fallo de PostgreSQL');
  const escenario = preparar({ errorAcceso: original });

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error === original,
  );

  assert.deepEqual(escenario.eventos, ['iniciar', 'autorizar']);
});

test('crear incidencia de mapa: no registra actividad si falla la inserción', async () => {
  const original = new Error('Falló la inserción');
  const escenario = preparar({ errorInsercion: original });

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error === original,
  );

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'insertar',
  ]);
});

test('crear incidencia de mapa: no confirma si falla la actividad', async () => {
  const original = new Error('Falló la actividad');
  const escenario = preparar({ errorActividad: original });

  await assert.rejects(
    escenario.ejecutar(),
    (error) => error === original,
  );

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'insertar', 'actividad',
  ]);
});

test('crear incidencia de mapa: no confirma si el registro tiene una ubicación inválida', async () => {
  const escenario = preparar({
    cambiosRegistro: { latitud: null },
  });

  await assert.rejects(
    escenario.ejecutar(),
    /ubicación inválida/,
  );

  assert.deepEqual(escenario.eventos, [
    'iniciar', 'autorizar', 'insertar', 'actividad',
  ]);
});