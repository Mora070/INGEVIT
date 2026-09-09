require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');

/**
 * Datos internos ficticios.
 * El repositorio recibe el hash, nunca la contraseña original.
 */
function crearDatos(cambios = {}) {
  return {
    correo: '  Persona@example.test  ',
    passwordHash: 'HASH_FICTICIO_NO_UTILIZAR',
    nombre: 'Persona',
    apellidos: 'De prueba',
    telefono: '+57 03001234567',
    ubicacion: 'Bogotá',
    ...cambios,
  };
}

function crearFila() {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'Persona@example.test',
    telefono: '+57 03001234567',
    password_hash: 'HASH_FICTICIO_NO_UTILIZAR',
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: 'Bogotá',
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: null,
  };
}

test('crearTradicional: parametriza los datos y devuelve el registro creado', async () => {
  const llamadas = [];
  const fila = crearFila();

  const repository = new UsuariosRepository({
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila] };
    },
  });

  const resultado = await repository.crearTradicional(crearDatos());

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);

  const { sql, values } = llamadas[0];

  assert.match(sql, /INSERT INTO obra\.usuarios/i);
  assert.match(sql, /RETURNING/i);

  assert.deepEqual(values, [
    'Persona@example.test',
    'HASH_FICTICIO_NO_UTILIZAR',
    'Persona',
    'De prueba',
    '+57 03001234567',
    'Bogotá',
  ]);

  // Los valores deben viajar como parámetros, no dentro del SQL.
  assert.equal(sql.includes('Persona@example.test'), false);
  assert.equal(sql.includes('HASH_FICTICIO_NO_UTILIZAR'), false);
});

test('crearTradicional: conserva los valores nulos del perfil', async () => {
  let parametros;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      parametros = values;
      return { rows: [crearFila()] };
    },
  });

  await repository.crearTradicional(
    crearDatos({
      nombre: null,
      apellidos: null,
      telefono: null,
      ubicacion: null,
    }),
  );

  assert.deepEqual(parametros, [
    'Persona@example.test',
    'HASH_FICTICIO_NO_UTILIZAR',
    null,
    null,
    null,
    null,
  ]);
});

test('crearTradicional: devuelve null ante un conflicto de correo', async () => {
  let sentencia;

  const repository = new UsuariosRepository({
    async query(sql) {
      sentencia = sql;

      // DO NOTHING no devuelve una fila cuando el correo ya existe.
      return { rows: [] };
    },
  });

  const resultado = await repository.crearTradicional(crearDatos());

  assert.equal(resultado, null);

  assert.match(
    sentencia,
    /ON CONFLICT\s*\(\s*lower\(correo\)\s*\)\s*DO NOTHING/i,
  );
});

test('crearTradicional: mantiene una entrada maliciosa fuera de la sentencia SQL', async () => {
  const nombreMalicioso = "Persona'); DROP TABLE obra.usuarios; --";
  let consulta;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [crearFila()] };
    },
  });

  await repository.crearTradicional(
    crearDatos({ nombre: nombreMalicioso }),
  );

  assert.equal(consulta.sql.includes(nombreMalicioso), false);
  assert.equal(consulta.values[2], nombreMalicioso);
});

test('crearTradicional: no permite que propiedades adicionales cambien los privilegios', async () => {
  let consulta;

  const repository = new UsuariosRepository({
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [crearFila()] };
    },
  });

  /**
   * JavaScript permite construir objetos con propiedades adicionales.
   * El repositorio debe utilizar únicamente los campos explícitos.
   */
  await repository.crearTradicional({
    ...crearDatos(),
    rol: 'ADMINISTRADOR',
    estado: 'INACTIVO',
    google_sub: 'IDENTIDAD_NO_AUTORIZADA',
  });

  assert.equal(consulta.values.includes('ADMINISTRADOR'), false);
  assert.equal(consulta.values.includes('INACTIVO'), false);
  assert.equal(
    consulta.values.includes('IDENTIDAD_NO_AUTORIZADA'),
    false,
  );

  assert.match(
    consulta.sql,
    /'USUARIO'\s*,\s*'ACTIVO'\s*,\s*NULL/i,
  );
});

test('crearTradicional: no modifica los datos recibidos', async () => {
  const datos = crearDatos();
  const original = structuredClone(datos);

  const repository = new UsuariosRepository({
    async query() {
      return { rows: [crearFila()] };
    },
  });

  await repository.crearTradicional(datos);

  assert.deepEqual(datos, original);
});

test('crearTradicional: propaga los errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const repository = new UsuariosRepository({
    async query() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () => repository.crearTradicional(crearDatos()),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});