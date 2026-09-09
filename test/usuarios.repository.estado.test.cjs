require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearFila(estado = 'ACTIVO') {
  return {
    id_usuario: ID_USUARIO,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: 'HASH_FICTICIO',
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado,
    google_sub: null,
  };
}

test('actualizarEstado: parametriza el UUID y el estado y devuelve la fila actualizada', async () => {
  const fila = crearFila('INACTIVO');
  const llamadas = [];

  const repository = new UsuariosRepository({
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila] };
    },
  });

  const resultado = await repository.actualizarEstado(
    ID_USUARIO,
    'INACTIVO',
  );

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);

  const { sql, values } = llamadas[0];

  assert.deepEqual(values, [ID_USUARIO, 'INACTIVO']);
  assert.match(sql, /UPDATE\s+obra\.usuarios/i);
  assert.match(
    sql,
    /SET\s+estado\s*=\s*\$2::obra\.estado_usuario\s+WHERE/i,
  );
  assert.match(sql, /WHERE\s+id_usuario\s*=\s*\$1::uuid/i);
  assert.match(sql, /RETURNING/i);

  assert.equal(sql.includes(ID_USUARIO), false);
  assert.equal(sql.includes('INACTIVO'), false);
});

test('actualizarEstado: admite una solicitud de activación', async () => {
  const fila = crearFila('ACTIVO');
  let parametros;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      parametros = values;
      return { rows: [fila] };
    },
  });

  const resultado = await repository.actualizarEstado(
    ID_USUARIO,
    'ACTIVO',
  );

  assert.deepEqual(parametros, [ID_USUARIO, 'ACTIVO']);
  assert.equal(resultado.estado, 'ACTIVO');
});

test('actualizarEstado: devuelve null cuando el usuario no existe', async () => {
  const repository = new UsuariosRepository({
    async query() {
      return { rows: [] };
    },
  });

  const resultado = await repository.actualizarEstado(
    ID_USUARIO,
    'INACTIVO',
  );

  assert.equal(resultado, null);
});

test('actualizarEstado: mantiene una entrada maliciosa fuera del SQL', async () => {
  const entradaMaliciosa = "'; DELETE FROM obra.usuarios; --";
  let consulta;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [] };
    },
  });

  /**
   * En HTTP rechazaremos este UUID antes de llegar al repositorio.
   * Aquí comprobamos que tampoco se interpola dentro de la sentencia.
   *
   * PostgreSQL real rechazaría su conversión a UUID.
   */
  await repository.actualizarEstado(
    entradaMaliciosa,
    'INACTIVO',
  );

  assert.equal(consulta.sql.includes(entradaMaliciosa), false);
  assert.deepEqual(consulta.values, [
    entradaMaliciosa,
    'INACTIVO',
  ]);
});

test('actualizarEstado: propaga el error original de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const repository = new UsuariosRepository({
    async query() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () => repository.actualizarEstado(ID_USUARIO, 'INACTIVO'),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});