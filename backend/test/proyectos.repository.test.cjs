require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearProyecto() {
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
  };
}

test('findDisponiblesByUsuario: parametriza la identidad y devuelve las filas', async () => {
  const filas = [crearProyecto()];
  const llamadas = [];

  const repository = new ProyectosRepository({
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: filas };
    },
  });

  const resultado = await repository.findDisponiblesByUsuario(
    ID_USUARIO,
  );

  assert.strictEqual(resultado, filas);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [ID_USUARIO]);

  assert.match(llamadas[0].sql, /FROM\s+obra\.proyectos/i);
  assert.match(llamadas[0].sql, /\$1::uuid/);
  assert.equal(llamadas[0].sql.includes(ID_USUARIO), false);
});

test('findDisponiblesByUsuario: devuelve una lista vacía cuando no hay resultados', async () => {
  const repository = new ProyectosRepository({
    async query() {
      return { rows: [] };
    },
  });

  const resultado = await repository.findDisponiblesByUsuario(
    ID_USUARIO,
  );

  assert.deepEqual(resultado, []);
});

test('findDisponiblesByUsuario: conserva la representación interna de fechas y coordenadas', async () => {
  const fila = crearProyecto();
  const original = structuredClone(fila);

  const repository = new ProyectosRepository({
    async query() {
      return { rows: [fila] };
    },
  });

  const resultado = await repository.findDisponiblesByUsuario(
    ID_USUARIO,
  );

  assert.deepEqual(fila, original);
  assert.equal(resultado[0].fecha_inicio, '2026-09-09');
  assert.equal(resultado[0].fecha_finalizacion, null);
  assert.equal(resultado[0].latitud, '4.7110');
  assert.equal(resultado[0].longitud, '-74.0721');
});

test('findDisponiblesByUsuario: mantiene una entrada maliciosa fuera del SQL', async () => {
  const entradaMaliciosa = "' OR true; --";
  let consulta;

  const repository = new ProyectosRepository({
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [] };
    },
  });

  /**
   * En HTTP validaremos la identidad mediante la autenticación.
   * PostgreSQL real rechazaría esta entrada al convertirla a UUID.
   * Aquí comprobamos que nunca se interpola en la sentencia.
   */
  await repository.findDisponiblesByUsuario(entradaMaliciosa);

  assert.equal(consulta.sql.includes(entradaMaliciosa), false);
  assert.deepEqual(consulta.values, [entradaMaliciosa]);
});

test('findDisponiblesByUsuario: propaga los errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const repository = new ProyectosRepository({
    async query() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () => repository.findDisponiblesByUsuario(ID_USUARIO),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('findDisponibleById: parametriza el proyecto y el solicitante', async () => {
  const fila = crearProyecto();
  const llamadas = [];

  const repository = new ProyectosRepository({
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila] };
    },
  });

  const resultado = await repository.findDisponibleById(
    fila.id_proyecto,
    ID_USUARIO,
  );

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [
    fila.id_proyecto,
    ID_USUARIO,
  ]);

  assert.match(
    llamadas[0].sql,
    /p\.id_proyecto\s*=\s*\$1::uuid/i,
  );
  assert.match(
    llamadas[0].sql,
    /solicitante\.id_usuario\s*=\s*\$2::uuid/i,
  );

  assert.equal(llamadas[0].sql.includes(fila.id_proyecto), false);
  assert.equal(llamadas[0].sql.includes(ID_USUARIO), false);
});

test('findDisponibleById: devuelve null cuando no obtiene un proyecto accesible', async () => {
  const repository = new ProyectosRepository({
    async query() {
      return { rows: [] };
    },
  });

  const resultado = await repository.findDisponibleById(
    crearProyecto().id_proyecto,
    ID_USUARIO,
  );

  assert.equal(resultado, null);
});

test('findDisponibleById: propaga los errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const repository = new ProyectosRepository({
    async query() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      repository.findDisponibleById(
        crearProyecto().id_proyecto,
        ID_USUARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});