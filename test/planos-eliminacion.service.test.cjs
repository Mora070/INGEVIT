require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosEliminacionService,
} = require('../dist/modules/planos/planos-eliminacion.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const CLAVE = `planos/${PLANO}.pdf`;

function preparar({
  disponible = true,
  existe = true,
  errorCola,
  errorActividad,
} = {}) {
  const client = {};
  const eventos = [];

  const service = new PlanosEliminacionService(
    {
      async withTransaction(operacion) {
        eventos.push('inicio');
        const resultado = await operacion(client);
        eventos.push('confirmacion');
        return resultado;
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(usuario, USUARIO);
        eventos.push('acceso');
        return disponible;
      },
    },
    {
      async eliminar(conexion, proyecto, plano) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(plano, PLANO);
        eventos.push('eliminacion');

        return existe
          ? { id_plano: PLANO, s3_key: CLAVE }
          : null;
      },
    },
    {
      async registrar(conexion, claves) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(claves, [CLAVE]);
        eventos.push('cola');

        if (errorCola) {
          throw errorCola;
        }
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: PROYECTO,
          idActor: USUARIO,
          tipoAccion: 'PLANO_ELIMINADO',
          mensaje: `Plano ${PLANO} eliminado.`,
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
    ejecutar: () => service.eliminar(PROYECTO, PLANO, USUARIO),
  };
}

test('PlanosEliminacion: elimina, encola y registra actividad en la misma transacción', async () => {
  const { ejecutar, eventos } = preparar();

  assert.equal(await ejecutar(), undefined);
  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'eliminacion',
    'cola',
    'actividad',
    'confirmacion',
  ]);
});

test('PlanosEliminacion: rechaza el acceso antes de eliminar', async () => {
  const { ejecutar, eventos } = preparar({ disponible: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El proyecto no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['inicio', 'acceso']);
});

test('PlanosEliminacion: no encola ni registra actividad si el plano no existe', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El plano no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'eliminacion',
  ]);
});

test('PlanosEliminacion: propaga el fallo de la cola sin confirmar', async () => {
  const original = new Error('Falló la cola');
  const { ejecutar, eventos } = preparar({ errorCola: original });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'eliminacion',
    'cola',
  ]);
});

test('PlanosEliminacion: propaga el fallo de actividad sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'eliminacion',
    'cola',
    'actividad',
  ]);
});