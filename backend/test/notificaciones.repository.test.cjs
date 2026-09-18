require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificacionesRepository,
} = require('../dist/modules/notificaciones/notificaciones.repository');

function crearDatos(cambios = {}) {
  return {
    id_receptor: '10000000-0000-4000-8000-000000000001',
    id_actor: '10000000-0000-4000-8000-000000000002',
    id_proyecto: '20000000-0000-4000-8000-000000000001',
    id_incidencia: '30000000-0000-4000-8000-000000000001',
    tipo: 'INCIDENCIA_CREADA',
    titulo: 'Nueva incidencia',
    mensaje: 'Se registró una incidencia en el proyecto.',
    ...cambios,
  };
}

test('NotificacionesRepository: parametriza todos los datos sin modificarlos', async () => {
  const repository = new NotificacionesRepository();

  const datos = crearDatos({
    mensaje: "Texto'); DELETE FROM obra.notificaciones; --",
  });
  const copia = { ...datos };
  let consultas = 0;

  const resultado = await repository.crear(
    {
      async query(sql, valores) {
        consultas += 1;

        assert.match(sql, /INSERT INTO obra\.notificaciones/i);
        assert.equal(sql.includes(datos.mensaje), false);

        assert.deepEqual(valores, [
          datos.id_receptor,
          datos.id_actor,
          datos.id_proyecto,
          datos.id_incidencia,
          datos.tipo,
          datos.titulo,
          datos.mensaje,
        ]);

        return { rowCount: 1 };
      },
    },
    datos,
  );

  assert.equal(resultado, undefined);
  assert.equal(consultas, 1);
  assert.deepEqual(datos, copia);
});

test('NotificacionesRepository: admite una notificación sin incidencia asociada', async () => {
  const repository = new NotificacionesRepository();
  const datos = crearDatos({ id_incidencia: null });

  await repository.crear(
    {
      async query(_sql, valores) {
        assert.equal(valores[3], null);
        return { rowCount: 1 };
      },
    },
    datos,
  );
});

test('NotificacionesRepository: propaga el error original de PostgreSQL', async () => {
  const repository = new NotificacionesRepository();
  const original = new Error('Falló PostgreSQL');

  await assert.rejects(
    repository.crear(
      {
        async query() {
          throw original;
        },
      },
      crearDatos(),
    ),
    (error) => error === original,
  );
});

test('NotificacionesRepository: rechaza un número inesperado de inserciones', async () => {
  const repository = new NotificacionesRepository();

  for (const rowCount of [0, null, 2]) {
    await assert.rejects(
      repository.crear(
        {
          async query() {
            return { rowCount };
          },
        },
        crearDatos(),
      ),
      {
        message:
          'No se pudo registrar exactamente una notificación.',
      },
    );
  }
});