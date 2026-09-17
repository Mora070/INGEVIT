require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');

const ID = '20000000-0000-4000-8000-000000000001';

test('password repository: parametriza la identidad y ambos hashes', async () => {
  const consultas = [];

  const repository = new UsuariosRepository({
    async query(sql, values) {
      consultas.push({ sql, values });
      return { rows: [], rowCount: 1 };
    },
  });

  const resultado = await repository.actualizarPasswordSiCoincide(
    ID,
    'hash-anterior',
    'hash-nuevo',
  );

  assert.equal(resultado, true);
  assert.equal(consultas.length, 1);

  assert.deepEqual(consultas[0].values, [
    ID,
    'hash-anterior',
    'hash-nuevo',
  ]);
});

test('password repository: devuelve false cuando no se actualiza la cuenta', async () => {
  const repository = new UsuariosRepository({
    async query() {
      return { rows: [], rowCount: 0 };
    },
  });

  assert.equal(
    await repository.actualizarPasswordSiCoincide(
      ID,
      'hash-anterior',
      'hash-nuevo',
    ),
    false,
  );
});

test('password repository: mantiene los valores fuera del SQL', async () => {
  let consulta;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [], rowCount: 0 };
    },
  });

  const hashActual = "anterior' OR TRUE --";
  const hashNuevo = "nuevo', rol = 'ADMINISTRADOR' --";

  await repository.actualizarPasswordSiCoincide(
    ID,
    hashActual,
    hashNuevo,
  );

  assert.equal(consulta.sql.includes(hashActual), false);
  assert.equal(consulta.sql.includes(hashNuevo), false);
  assert.deepEqual(consulta.values, [ID, hashActual, hashNuevo]);
});

test('password repository: devuelve un booleano aunque el resultado incluya filas', async () => {
  const repository = new UsuariosRepository({
    async query() {
      return {
        rows: [{ password_hash: 'dato-interno' }],
        rowCount: 1,
      };
    },
  });

  const resultado = await repository.actualizarPasswordSiCoincide(
    ID,
    'hash-anterior',
    'hash-nuevo',
  );

  assert.strictEqual(resultado, true);
});

test('password repository: propaga errores sin repetir la actualización', async () => {
  const error = new Error('Fallo simulado de PostgreSQL');
  let consultas = 0;

  const repository = new UsuariosRepository({
    async query() {
      consultas += 1;
      throw error;
    },
  });

  await assert.rejects(
    () => repository.actualizarPasswordSiCoincide(
      ID,
      'hash-anterior',
      'hash-nuevo',
    ),
    (recibido) => recibido === error,
  );

  assert.equal(consultas, 1);
});