require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_PROYECTO = '10000000-0000-4000-8000-000000000001';
const ID_USUARIO = '20000000-0000-4000-8000-000000000002';

/**
 * Impide que estos métodos utilicen el pool directamente.
 * Deben ejecutar sus consultas con el cliente transaccional recibido.
 */
function crearRepositorio() {
  return new ProyectosRepository({
    async query() {
      throw new Error('Debe utilizarse el cliente transaccional.');
    },
  });
}

test('bloquearUsuarioExistente: parametriza el UUID y permite una cuenta existente', async () => {
  const llamadas = [];

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [{ id_usuario: ID_USUARIO }] };
    },
  };

  const resultado = await crearRepositorio().bloquearUsuarioExistente(
    client,
    ID_USUARIO,
  );

  assert.equal(resultado, true);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [ID_USUARIO]);

  assert.match(llamadas[0].sql, /FROM\s+obra\.usuarios/i);
  assert.match(llamadas[0].sql, /id_usuario\s*=\s*\$1::uuid/i);
  assert.match(llamadas[0].sql, /FOR KEY SHARE/i);

  // Esta operación comprueba existencia, no exige una cuenta activa.
  assert.doesNotMatch(llamadas[0].sql, /\bestado\s*=/i);
  assert.equal(llamadas[0].sql.includes(ID_USUARIO), false);
});

test('bloquearUsuarioExistente: devuelve false cuando la cuenta no existe', async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  };

  const resultado = await crearRepositorio().bloquearUsuarioExistente(
    client,
    ID_USUARIO,
  );

  assert.equal(resultado, false);
});

test('bloquearUsuarioExistente: propaga errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de consulta');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().bloquearUsuarioExistente(
        client,
        ID_USUARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('agregarColaborador: inserta con parámetros y devuelve true para una relación nueva', async () => {
  const llamadas = [];

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rowCount: 1 };
    },
  };

  const resultado = await crearRepositorio().agregarColaborador(
    client,
    ID_PROYECTO,
    ID_USUARIO,
  );

  assert.equal(resultado, true);
  assert.equal(llamadas.length, 1);

  // La firma recibe proyecto/usuario; el SQL inserta usuario/proyecto.
  assert.deepEqual(llamadas[0].values, [
    ID_USUARIO,
    ID_PROYECTO,
  ]);

  assert.match(
    llamadas[0].sql,
    /INSERT INTO obra\.usuario_proyecto/i,
  );

  assert.match(
    llamadas[0].sql,
    /ON CONFLICT\s*\(id_usuario,\s*id_proyecto\)\s*DO NOTHING/i,
  );

  assert.equal(llamadas[0].sql.includes(ID_USUARIO), false);
  assert.equal(llamadas[0].sql.includes(ID_PROYECTO), false);
});

test('agregarColaborador: devuelve false cuando la relación ya existe', async () => {
  const client = {
    async query() {
      return { rowCount: 0 };
    },
  };

  const resultado = await crearRepositorio().agregarColaborador(
    client,
    ID_PROYECTO,
    ID_USUARIO,
  );

  assert.equal(resultado, false);
});

test('agregarColaborador: rechaza un resultado inesperado de la inserción', async () => {
  for (const rowCount of [null, 2]) {
    const client = {
      async query() {
        return { rowCount };
      },
    };

    await assert.rejects(
      () =>
        crearRepositorio().agregarColaborador(
          client,
          ID_PROYECTO,
          ID_USUARIO,
        ),
      {
        message:
          'La inserción del colaborador devolvió un resultado inesperado.',
      },
    );
  }
});

test('agregarColaborador: propaga los errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de inserción');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().agregarColaborador(
        client,
        ID_PROYECTO,
        ID_USUARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});