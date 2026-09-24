require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PanoramicasRepository,
} = require('../dist/modules/panoramicas/panoramicas.repository');

const {
  PanoramicasEdicionService,
} = require('../dist/modules/panoramicas/panoramicas-edicion.service');

function preparar({
  acceso = true,
  existe = true,
  errorActividad,
} = {}) {
  const eventos = [];

  const client = {
    async query(sql, valores) {
      assert.deepEqual(valores, [
        'proyecto', 'panoramica', "Título'; SELECT 1; --",
      ]);
      assert.equal(sql.includes(valores[2]), false);
      assert.match(sql, /SET\s+titulo\s*=\s*\$3/i);
      assert.match(sql, /WHERE\s+id_proyecto\s*=\s*\$1/i);
      assert.match(sql, /AND\s+id_panoramica\s*=\s*\$2/i);

      eventos.push('actualizar');

      return existe ? {
        rowCount: 1,
        rows: [{
          id_panoramica: 'panoramica',
          id_proyecto: 'proyecto',
          id_usuario_subida: 'autor-original',
          titulo: valores[2],
          url: '/imagen.png',
          s3_key: 'panoramicas/clave.png',
          mime_type: 'image/png',
          fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
          latitud: '4.711',
          longitud: '-74.0721',
        }],
      } : { rowCount: 0, rows: [] };
    },
  };

  const service = new PanoramicasEdicionService(
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
    new PanoramicasRepository(),
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: 'proyecto',
          idActor: 'editor',
          tipoAccion: 'PANORAMICA_TITULO_GUARDADO',
          mensaje: 'Título de la panorámica panoramica guardado.',
        });

        eventos.push('actividad');
        if (errorActividad) throw errorActividad;
      },
    },
  );

  return {
    eventos,
    ejecutar: () => service.actualizarTitulo(
      'proyecto', 'panoramica', 'editor', "Título'; SELECT 1; --",
    ),
  };
}

test('PanoramicasEdicion: parametriza, conserva el autor y devuelve campos públicos', async () => {
  const { ejecutar, eventos } = preparar();

  assert.deepEqual(await ejecutar(), {
    id_panoramica: 'panoramica',
    id_proyecto: 'proyecto',
    id_usuario_subida: 'autor-original',
    titulo: "Título'; SELECT 1; --",
    url: '/imagen.png',
    mime_type: 'image/png',
    fecha_subida: '2026-09-15T12:00:00.000Z',
    latitud: 4.711,
    longitud: -74.0721,
  });

  assert.deepEqual(eventos, [
    'acceso', 'actualizar', 'actividad', 'confirmar',
  ]);
});

test('PanoramicasEdicion: rechaza el proyecto antes de actualizar', async () => {
  const { ejecutar, eventos } = preparar({ acceso: false });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('PanoramicasEdicion: no registra actividad para una panorámica inexistente', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'La panorámica no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['acceso', 'actualizar']);
});

test('PanoramicasEdicion: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, ['acceso', 'actualizar', 'actividad']);
});