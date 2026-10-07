require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosRepository,
} = require('../dist/modules/planos/planos.repository');

const {
  PlanosEdicionService,
} = require('../dist/modules/planos/planos-edicion.service');

function preparar({
  acceso = true,
  existe = true,
  errorActividad,
} = {}) {
  const eventos = [];

  const client = {
    async query(sql, valores) {
      assert.deepEqual(valores, [
        'proyecto', 'plano', "Plano corregido'; SELECT 1; --", 'Descripción actualizada',
      ]);
      assert.equal(sql.includes(valores[2]), false);
      assert.match(sql, /SET\s+/i);
      assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
      assert.match(sql, /AND\s+id_plano\s*=\s*\$2/i);

      eventos.push('actualizar');

      return existe ? {
        rowCount: 1,
        rows: [{
          id_plano: 'plano',
          id_proyecto: 'proyecto',
          id_usuario_subida: 'autor-original',
          titulo: valores[2],
          descripcion: valores[3],
          url: '/plano.pdf',
          s3_key: 'planos/clave.pdf',
          mime_type: 'application/pdf',
          numero_paginas: 2,
          fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
        }],
      } : { rowCount: 0, rows: [] };
    },
  };

  const service = new PlanosEdicionService(
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
        assert.deepEqual([proyecto, usuario], ['proyecto', 'editor']);
        eventos.push('acceso');
        return acceso;
      },
    },
    new PlanosRepository(),
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: 'proyecto',
          idActor: 'editor',
          tipoAccion: 'PLANO_DATOS_GUARDADOS',
          mensaje: 'Datos del plano plano guardados.',
        });

        eventos.push('actividad');
        if (errorActividad) throw errorActividad;
      },
    },
    {
      async crearParaParticipantesProyecto(conexion) {
        assert.strictEqual(conexion, client);
        eventos.push('notificacion');
      },
    },
  );

  return {
    eventos,
    ejecutar: () => service.actualizarDatos(
      'proyecto', 'plano', 'editor', {
        titulo: "Plano corregido'; SELECT 1; --",
        descripcion: 'Descripción actualizada',
      },
    ),
  };
}

test('PlanosEdicion: coordina acceso, actualización e historial y conserva el autor', async () => {
  const { ejecutar, eventos } = preparar();

  assert.deepEqual(await ejecutar(), {
    id_plano: 'plano',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'autor-original',
    titulo: "Plano corregido'; SELECT 1; --",
    descripcion: 'Descripción actualizada',
    url: '/plano.pdf',
    mime_type: 'application/pdf',
    fecha_subida: '2026-09-15T12:00:00.000Z',
  });

  assert.deepEqual(eventos, [
    'acceso', 'actualizar', 'actividad', 'notificacion', 'confirmar',
  ]);
});

test('PlanosEdicion: rechaza el proyecto antes de actualizar', async () => {
  const { ejecutar, eventos } = preparar({ acceso: false });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('PlanosEdicion: no registra actividad para un plano inexistente', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El plano no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['acceso', 'actualizar']);
});

test('PlanosEdicion: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, ['acceso', 'actualizar', 'actividad']);
});