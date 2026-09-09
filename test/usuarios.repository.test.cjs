require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');

/**
 * Usuario ficticio para comprobar el comportamiento del repositorio.
 *
 * Se utiliza un usuario inactivo porque el repositorio también debe
 * recuperar esas cuentas. La autorización corresponde al servicio.
 */
function crearUsuarioDePrueba() {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: 'HASH_FICTICIO_NO_UTILIZAR',
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'INACTIVO',
    google_sub: 'google-sub-de-prueba',
  };
}

/**
 * Describe las tres búsquedas del repositorio.
 *
 * Las expresiones comprueban la condición principal sin depender
 * de la indentación o los saltos de línea de la consulta.
 */
const casos = [
  {
    metodo: 'findById',
    entrada: '10000000-0000-4000-8000-000000000001',
    parametro: '10000000-0000-4000-8000-000000000001',
    condicion: /WHERE\s+id_usuario\s*=\s*\$1::uuid/i,
  },
  {
    metodo: 'findByCorreo',
    entrada: '  Persona@Example.test  ',
    parametro: 'Persona@Example.test',
    condicion: /WHERE\s+lower\(correo\)\s*=\s*lower\(\$1::text\)/i,
  },
  {
    metodo: 'findByGoogleSub',
    entrada: 'google-sub-de-prueba',
    parametro: 'google-sub-de-prueba',
    condicion: /WHERE\s+google_sub\s*=\s*\$1/i,
  },
];

for (const caso of casos) {
  test(`${caso.metodo}: parametriza la búsqueda y devuelve el usuario`, async () => {
    const usuario = crearUsuarioDePrueba();
    const original = structuredClone(usuario);
    const llamadas = [];

    // Sustituye únicamente la dependencia utilizada por el repositorio.
    const database = {
      async query(sql, values) {
        llamadas.push({ sql, values });
        return { rows: [usuario] };
      },
    };

    const repository = new UsuariosRepository(database);

    const resultado = await repository[caso.metodo](caso.entrada);

    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].sql, /FROM\s+obra\.usuarios/i);
    assert.match(llamadas[0].sql, caso.condicion);
    assert.deepStrictEqual(llamadas[0].values, [caso.parametro]);

    // El repositorio devuelve el objeto interno sin transformarlo.
    assert.strictEqual(resultado, usuario);
    assert.deepStrictEqual(usuario, original);
  });

  test(`${caso.metodo}: devuelve null cuando no hay resultados`, async () => {
    const database = {
      async query() {
        return { rows: [] };
      },
    };

    const repository = new UsuariosRepository(database);

    const resultado = await repository[caso.metodo](caso.entrada);

    assert.equal(resultado, null);
  });

  test(`${caso.metodo}: propaga el error de la base de datos`, async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');

    const database = {
      async query() {
        throw errorEsperado;
      },
    };

    const repository = new UsuariosRepository(database);

    await assert.rejects(
      () => repository[caso.metodo](caso.entrada),
      (error) => error === errorEsperado,
    );
  });
}

test('findByCorreo: mantiene una entrada maliciosa fuera del SQL', async () => {
  const entrada = "persona@example.test' OR 1=1 --";
  let consultaRecibida;

  const database = {
    async query(sql, values) {
      consultaRecibida = { sql, values };
      return { rows: [] };
    },
  };

  const repository = new UsuariosRepository(database);

  await repository.findByCorreo(entrada);

  assert.equal(consultaRecibida.sql.includes(entrada), false);
  assert.deepStrictEqual(consultaRecibida.values, [entrada]);
});