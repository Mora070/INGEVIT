require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearFila(cambios = {}) {
  return {
    id_proyecto: '20000000-0000-4000-8000-000000000002',
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: '4.7110',
    longitud: '-74.0721',
    total: '45',
    ...cambios,
  };
}

/**
 * Representa la fila que devuelve el LEFT JOIN
 * cuando la página solicitada no contiene proyectos.
 */
function crearPaginaVacia(total) {
  return {
    id_proyecto: null,
    id_propietario: null,
    nombre: null,
    descripcion: null,
    direccion: null,
    contratante: null,
    fecha_inicio: null,
    fecha_finalizacion: null,
    estado_proyecto: null,
    activo: null,
    latitud: null,
    longitud: null,
    total,
  };
}

test('paginación: parametriza el usuario, el límite y el desplazamiento', async () => {
  const llamadas = [];

  const repository = new ProyectosRepository({
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [crearFila()] };
    },
  });

  await repository.findDisponiblesPaginadosByUsuario(
    ID_USUARIO,
    3,
    20,
  );

  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [ID_USUARIO, 20, 40]);

  assert.match(llamadas[0].sql, /LIMIT\s+\$2::integer/i);
  assert.match(llamadas[0].sql, /OFFSET\s+\$3::bigint/i);
  assert.equal(llamadas[0].sql.includes(ID_USUARIO), false);
});

test('paginación: la primera página utiliza desplazamiento cero', async () => {
  let parametros;

  const repository = new ProyectosRepository({
    async query(sql, values) {
      parametros = values;
      return { rows: [crearPaginaVacia('0')] };
    },
  });

  await repository.findDisponiblesPaginadosByUsuario(
    ID_USUARIO,
    1,
    20,
  );

  assert.deepEqual(parametros, [ID_USUARIO, 20, 0]);
});

test('paginación: separa el total de los proyectos y conserva su orden', async () => {
  const primera = crearFila();
  const segunda = crearFila({
    id_proyecto: '30000000-0000-4000-8000-000000000003',
  });

  const repository = new ProyectosRepository({
    async query() {
      return { rows: [primera, segunda] };
    },
  });

  const resultado =
    await repository.findDisponiblesPaginadosByUsuario(
      ID_USUARIO,
      1,
      20,
    );

  assert.equal(resultado.total, 45);

  assert.deepEqual(
    resultado.proyectos.map((proyecto) => proyecto.id_proyecto),
    [primera.id_proyecto, segunda.id_proyecto],
  );

  for (const proyecto of resultado.proyectos) {
    assert.equal(Object.hasOwn(proyecto, 'total'), false);
    assert.equal(proyecto.fecha_inicio, '2026-09-09');
    assert.equal(proyecto.latitud, '4.7110');
  }
});

test('paginación: conserva el total cuando la página está fuera de rango', async () => {
  const repository = new ProyectosRepository({
    async query() {
      return { rows: [crearPaginaVacia('45')] };
    },
  });

  const resultado =
    await repository.findDisponiblesPaginadosByUsuario(
      ID_USUARIO,
      10,
      20,
    );

  assert.deepEqual(resultado, {
    proyectos: [],
    total: 45,
  });
});

test('paginación: devuelve cero cuando no hay proyectos accesibles', async () => {
  const repository = new ProyectosRepository({
    async query() {
      return { rows: [crearPaginaVacia('0')] };
    },
  });

  const resultado =
    await repository.findDisponiblesPaginadosByUsuario(
      ID_USUARIO,
      1,
      20,
    );

  assert.deepEqual(resultado, {
    proyectos: [],
    total: 0,
  });
});

test('paginación: rechaza una respuesta sin la fila de conteo', async () => {
  const repository = new ProyectosRepository({
    async query() {
      return { rows: [] };
    },
  });

  await assert.rejects(
    () =>
      repository.findDisponiblesPaginadosByUsuario(
        ID_USUARIO,
        1,
        20,
      ),
    {
      message:
        'La consulta paginada no devolvió el conteo esperado.',
    },
  );
});

test('paginación: rechaza totales negativos, fraccionarios o no representables', async () => {
  for (const total of [
    '-1',
    '1.5',
    'NaN',
    'Infinity',
    '9007199254740992',
  ]) {
    const repository = new ProyectosRepository({
      async query() {
        return { rows: [crearPaginaVacia(total)] };
      },
    });

    await assert.rejects(
      () =>
        repository.findDisponiblesPaginadosByUsuario(
          ID_USUARIO,
          1,
          20,
        ),
      {
        message:
          'El total de proyectos no puede representarse correctamente.',
      },
    );
  }
});

test('paginación: no modifica las filas recibidas de PostgreSQL', async () => {
  const filas = [crearFila()];
  const original = structuredClone(filas);

  const repository = new ProyectosRepository({
    async query() {
      return { rows: filas };
    },
  });

  await repository.findDisponiblesPaginadosByUsuario(
    ID_USUARIO,
    1,
    20,
  );

  assert.deepEqual(filas, original);
});

test('paginación: propaga los errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const repository = new ProyectosRepository({
    async query() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      repository.findDisponiblesPaginadosByUsuario(
        ID_USUARIO,
        1,
        20,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});