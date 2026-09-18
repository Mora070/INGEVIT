require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');

const ID = '20000000-0000-4000-8000-000000000001';

function crearEscenario(filas = []) {
  const consultas = [];

  const database = {
    async query(sql, values) {
      consultas.push({ sql, values });
      return {
        rows: filas,
        rowCount: filas.length,
      };
    },
  };

  return {
    repository: new UsuariosRepository(database),
    consultas,
  };
}

test('perfil repository: parametriza los cuatro campos y devuelve el resultado', async () => {
  const fila = { id_usuario: ID, nombre: 'Ana' };
  const e = crearEscenario([fila]);

  const resultado = await e.repository.actualizarPerfil(ID, {
    nombre: 'Ana',
    apellidos: 'Pérez',
    telefono: '+57 300 123 4567',
    ubicacion: 'Bogotá',
  });

  assert.strictEqual(resultado, fila);
  assert.equal(e.consultas.length, 1);

  assert.deepEqual(e.consultas[0].values, [
    ID,
    true, 'Ana',
    true, 'Pérez',
    true, '+57 300 123 4567',
    true, 'Bogotá',
  ]);
});

test('perfil repository: distingue campos omitidos de campos enviados como null', async () => {
  const e = crearEscenario();

  await e.repository.actualizarPerfil(ID, {
    nombre: 'Ana',
    telefono: null,
  });

  assert.deepEqual(e.consultas[0].values, [
    ID,
    true, 'Ana',
    false, null,
    true, null,
    false, null,
  ]);
});

test('perfil repository: devuelve null cuando el UPDATE no encuentra una cuenta activa', async () => {
  const e = crearEscenario();

  assert.equal(
    await e.repository.actualizarPerfil(ID, { nombre: 'Ana' }),
    null,
  );
});

test('perfil repository: mantiene el contenido externo fuera del SQL', async () => {
  const e = crearEscenario();
  const texto = "Ana', rol = 'ADMINISTRADOR' --";

  await e.repository.actualizarPerfil(ID, { nombre: texto });

  assert.equal(e.consultas[0].sql.includes(texto), false);
  assert.equal(e.consultas[0].values[2], texto);
});

test('perfil repository: no modifica la entrada ni utiliza campos adicionales', async () => {
  const e = crearEscenario();

  const entrada = Object.freeze({
    nombre: 'Ana',
    rol: 'ADMINISTRADOR',
    estado: 'INACTIVO',
    correo: 'otro@example.invalid',
  });

  await e.repository.actualizarPerfil(ID, entrada);

  assert.equal(entrada.nombre, 'Ana');

  assert.deepEqual(e.consultas[0].values, [
    ID,
    true, 'Ana',
    false, null,
    false, null,
    false, null,
  ]);
});

test('perfil repository: propaga errores de PostgreSQL sin reintentar', async () => {
  const error = new Error('Error de PostgreSQL simulado');
  let consultas = 0;

  const repository = new UsuariosRepository({
    async query() {
      consultas += 1;
      throw error;
    },
  });

  await assert.rejects(
    () => repository.actualizarPerfil(ID, { nombre: 'Ana' }),
    (recibido) => recibido === error,
  );

  assert.equal(consultas, 1);
});