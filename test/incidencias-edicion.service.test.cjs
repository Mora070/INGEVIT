require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  IncidenciasEdicionService,
} = require('../dist/modules/incidencias/incidencias-edicion.service');

const DATOS = {
  titulo: 'Revisión completada',
  descripcion: 'Trabajo verificado.',
  prioridad: 'BAJA',
  estado: 'SOLUCIONADA',
};

function preparar({
  acceso = true,
  paginas = 2,
  existe = true,
  errorActividad,
} = {}) {
  const eventos = [];
  const client = {};

  const service = new IncidenciasEdicionService(
    {
      async withTransaction(operacion) {
        const resultado = await operacion(client);
        eventos.push('confirmar');
        return resultado;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, 'proyecto');
        assert.equal(usuario, 'editor');
        eventos.push('acceso');
        return acceso;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, plano) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, 'proyecto');
        assert.equal(plano, 'plano');
        eventos.push('plano');
        return paginas;
      },
    },
    {
      async actualizarDatos(conexion, proyecto, plano, id, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, plano, id], [
          'proyecto', 'plano', 'incidencia',
        ]);
        assert.deepEqual(datos, DATOS);
        eventos.push('actualizar');

        return existe ? {
          id_incidencia: 'incidencia',
          id_proyecto: 'proyecto',
          id_plano: 'plano',
          id_creador: 'creador-original',
          ...datos,
          numero_pagina: 2,
          coordenada_x: '120.5',
          coordenada_y: '80.25',
          fecha_creacion: new Date('2026-09-15T12:00:00.000Z'),
        } : null;
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: 'proyecto',
          idActor: 'editor',
          tipoAccion: 'INCIDENCIA_DATOS_GUARDADOS',
          mensaje: 'Datos de la incidencia incidencia guardados.',
        });
        eventos.push('actividad');

        if (errorActividad) {
          throw errorActividad;
        }
      },
    },
  );

  return {
    eventos,
    ejecutar: () => service.actualizarDatos(
      'proyecto', 'plano', 'incidencia', 'editor', DATOS,
    ),
  };
}

test('IncidenciasEdicion: conserva creador y ubicación y registra al editor', async () => {
  const { ejecutar, eventos } = preparar();
  const resultado = await ejecutar();

  assert.deepEqual(resultado, {
    id_incidencia: 'incidencia',
    id_proyecto: 'proyecto',
    id_plano: 'plano',
    id_creador: 'creador-original',
    ...DATOS,
    numero_pagina: 2,
    coordenada_x: 120.5,
    coordenada_y: 80.25,
    fecha_creacion: '2026-09-15T12:00:00.000Z',
  });

  assert.deepEqual(eventos, [
    'acceso', 'plano', 'actualizar', 'actividad', 'confirmar',
  ]);
});

for (const [nombre, opciones, mensaje, eventosEsperados] of [
  [
    'proyecto inaccesible',
    { acceso: false },
    'El proyecto no está disponible.',
    ['acceso'],
  ],
  [
    'plano inexistente',
    { paginas: null },
    'El plano no está disponible.',
    ['acceso', 'plano'],
  ],
  [
    'incidencia inexistente',
    { existe: false },
    'La incidencia no está disponible.',
    ['acceso', 'plano', 'actualizar'],
  ],
]) {
  test(`IncidenciasEdicion: rechaza ${nombre}`, async () => {
    const { ejecutar, eventos } = preparar(opciones);

    await assert.rejects(ejecutar(), (error) => {
      assert.equal(error.getStatus(), 404);
      assert.equal(error.message, mensaje);
      return true;
    });

    assert.deepEqual(eventos, eventosEsperados);
  });
}

test('IncidenciasEdicion: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso', 'plano', 'actualizar', 'actividad',
  ]);
});