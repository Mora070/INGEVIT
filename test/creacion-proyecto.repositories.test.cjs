require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const {
  ActividadesRepository,
} = require('../dist/modules/actividades/actividades.repository');

const ID_PROPIETARIO = '10000000-0000-4000-8000-000000000001';
const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';

function crearDatosProyecto(cambios = {}) {
  return {
    idPropietario: ID_PROPIETARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fechaInicio: '2026-09-09',
    fechaFinalizacion: null,
    estadoProyecto: 'ACTIVA',
    latitud: null,
    longitud: null,
    ...cambios,
  };
}

function crearFilaProyecto() {
  return {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_PROPIETARIO,
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
  };
}

/**
 * Si crear() intenta utilizar el pool directamente,
 * la prueba debe fallar.
 */
function crearRepositorioProyectos() {
  return new ProyectosRepository({
    async query() {
      throw new Error(
        'La creación debe utilizar el cliente transaccional.',
      );
    },
  });
}

function crearDatosActividad() {
  return {
    idProyecto: ID_PROYECTO,
    idActor: ID_PROPIETARIO,
    tipoAccion: 'PROYECTO_CREADO',
    mensaje: 'Proyecto creado.',
  };
}

test('ProyectosRepository.crear: utiliza el cliente recibido y parametriza la inserción', async () => {
  const llamadas = [];
  const fila = crearFilaProyecto();

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila], rowCount: 1 };
    },
  };

  const repository = crearRepositorioProyectos();
  const resultado = await repository.crear(
    client,
    crearDatosProyecto(),
  );

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].sql, /INSERT INTO obra\.proyectos/i);

  assert.deepEqual(llamadas[0].values, [
    ID_PROPIETARIO,
    'Proyecto de prueba',
    'Descripción de prueba',
    'Dirección de prueba',
    'Cliente de prueba',
    '2026-09-09',
    null,
    'ACTIVA',
    null,
    null,
  ]);

  assert.equal(llamadas[0].sql.includes(ID_PROPIETARIO), false);
});

test('ProyectosRepository.crear: conserva fechas y coordenadas proporcionadas', async () => {
  let parametros;

  const client = {
    async query(sql, values) {
      parametros = values;
      return { rows: [crearFilaProyecto()], rowCount: 1 };
    },
  };

  await crearRepositorioProyectos().crear(
    client,
    crearDatosProyecto({
      fechaFinalizacion: '2026-12-31',
      latitud: 0,
      longitud: -74.0721,
    }),
  );

  assert.equal(parametros[6], '2026-12-31');
  assert.equal(parametros[8], 0);
  assert.equal(parametros[9], -74.0721);
});

test('ProyectosRepository.crear: rechaza una inserción sin registro retornado', async () => {
  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  await assert.rejects(
    () =>
      crearRepositorioProyectos().crear(
        client,
        crearDatosProyecto(),
      ),
    {
      message:
        'La inserción del proyecto no devolvió el registro creado.',
    },
  );
});

test('ProyectosRepository.crear: propaga el error original del cliente', async () => {
  const errorOriginal = new Error('Fallo simulado al crear proyecto');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorioProyectos().crear(
        client,
        crearDatosProyecto(),
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('ActividadesRepository.crear: utiliza el cliente recibido y parametriza la actividad', async () => {
  const llamadas = [];

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rowCount: 1 };
    },
  };

  const repository = new ActividadesRepository();

  await repository.crear(client, crearDatosActividad());

  assert.equal(llamadas.length, 1);
  assert.match(
    llamadas[0].sql,
    /INSERT INTO obra\.actividades/i,
  );

  assert.deepEqual(llamadas[0].values, [
    ID_PROYECTO,
    ID_PROPIETARIO,
    'PROYECTO_CREADO',
    'Proyecto creado.',
  ]);

  assert.equal(llamadas[0].sql.includes(ID_PROYECTO), false);
  assert.equal(llamadas[0].sql.includes(ID_PROPIETARIO), false);
});

test('ActividadesRepository.crear: rechaza resultados distintos de una fila insertada', async () => {
  for (const rowCount of [0, null, 2]) {
    const client = {
      async query() {
        return { rowCount };
      },
    };

    const repository = new ActividadesRepository();

    await assert.rejects(
      () => repository.crear(client, crearDatosActividad()),
      {
        message: 'No se pudo registrar la actividad del proyecto.',
      },
    );
  }
});

test('ActividadesRepository.crear: propaga el error original del cliente', async () => {
  const errorOriginal = new Error('Fallo simulado al crear actividad');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  const repository = new ActividadesRepository();

  await assert.rejects(
    () => repository.crear(client, crearDatosActividad()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});