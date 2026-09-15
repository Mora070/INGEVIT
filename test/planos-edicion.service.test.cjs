require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosEdicionService,
} = require('../dist/modules/planos/planos-edicion.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const AUTOR = '10000000-0000-4000-8000-000000000002';

const DATOS = {
  titulo: 'Título actualizado',
  descripcion: '',
};

function preparar({
  disponible = true,
  existe = true,
  errorActualizacion,
  errorActividad,
} = {}) {
  const client = {};
  const eventos = [];

  const service = new PlanosEdicionService(
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
      async actualizarDatos(conexion, proyecto, plano, datos) {
        assert.strictEqual(conexion, client);
        assert.equal(proyecto, PROYECTO);
        assert.equal(plano, PLANO);
        assert.deepEqual(datos, DATOS);
        eventos.push('actualizacion');

        if (errorActualizacion) {
          throw errorActualizacion;
        }

        if (!existe) {
          return null;
        }

        return {
          id_plano: PLANO,
          id_proyecto: PROYECTO,
          id_usuario_subida: AUTOR,
          ...datos,
          url: '/plano.pdf',
          s3_key: `planos/${PLANO}.pdf`,
          mime_type: 'application/pdf',
          fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
        };
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: PROYECTO,
          idActor: USUARIO,
          tipoAccion: 'PLANO_DATOS_GUARDADOS',
          mensaje: `Datos del plano ${PLANO} guardados.`,
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
    ejecutar: () =>
      service.actualizarDatos(PROYECTO, PLANO, USUARIO, DATOS),
  };
}

test('PlanosEdicion: coordina acceso, actualización e historial y conserva el autor', async () => {
  const { ejecutar, eventos } = preparar();
  const resultado = await ejecutar();

  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'actualizacion',
    'actividad',
    'confirmacion',
  ]);

  assert.deepEqual(resultado, {
    id_plano: PLANO,
    id_proyecto: PROYECTO,
    id_usuario_subida: AUTOR,
    titulo: DATOS.titulo,
    descripcion: '',
    url: '/plano.pdf',
    mime_type: 'application/pdf',
    fecha_subida: '2026-09-15T12:00:00.000Z',
  });
});

test('PlanosEdicion: rechaza el proyecto no disponible antes de actualizar', async () => {
  const { ejecutar, eventos } = preparar({ disponible: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El proyecto no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, ['inicio', 'acceso']);
});

test('PlanosEdicion: no registra actividad si el plano no existe', async () => {
  const { ejecutar, eventos } = preparar({ existe: false });

  await assert.rejects(ejecutar(), (error) => {
    assert.equal(error.getStatus(), 404);
    assert.equal(error.message, 'El plano no está disponible.');
    return true;
  });

  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'actualizacion',
  ]);
});

test('PlanosEdicion: propaga el fallo de actualización sin registrar actividad', async () => {
  const original = new Error('Falló la actualización');
  const { ejecutar, eventos } = preparar({
    errorActualizacion: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);

  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'actualizacion',
  ]);
});

test('PlanosEdicion: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);

  assert.deepEqual(eventos, [
    'inicio',
    'acceso',
    'actualizacion',
    'actividad',
  ]);
});