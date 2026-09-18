require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PasswordService,
} = require('../dist/modules/auth/services/password.service');

/**
 * Todas las contraseñas de este archivo son ficticias.
 * Estas pruebas no crean cuentas ni escriben en PostgreSQL.
 */

test('PasswordService: genera un hash Argon2id y verifica la contraseña original', async () => {
  const service = new PasswordService();
  const password = 'Clave ficticia de prueba';

  const hash = await service.generarHash(password);

  assert.equal(typeof hash, 'string');
  assert.ok(hash.startsWith('$argon2id$'));
  assert.notEqual(hash, password);

  const coincide = await service.verificar(password, hash);

  assert.equal(coincide, true);
});

test('PasswordService: rechaza una contraseña incorrecta', async () => {
  const service = new PasswordService();
  const hash = await service.generarHash('Clave original');

  const coincide = await service.verificar(
    'Otra clave diferente',
    hash,
  );

  assert.equal(coincide, false);
});

test('PasswordService: genera hashes diferentes para la misma contraseña', async () => {
  const service = new PasswordService();
  const password = 'Misma clave ficticia';

  // Cada operación debe generar su propia sal aleatoria.
  const primerHash = await service.generarHash(password);
  const segundoHash = await service.generarHash(password);

  assert.notEqual(primerHash, segundoHash);

  // Ambos resultados deben seguir verificando la contraseña original.
  assert.equal(
    await service.verificar(password, primerHash),
    true,
  );

  assert.equal(
    await service.verificar(password, segundoHash),
    true,
  );
});

test('PasswordService: conserva los espacios de la contraseña', async () => {
  const service = new PasswordService();
  const password = '  Clave con espacios  ';
  const hash = await service.generarHash(password);

  assert.equal(
    await service.verificar(password, hash),
    true,
  );

  // Aplicar trim() cambiaría la contraseña y debe impedir la coincidencia.
  assert.equal(
    await service.verificar(password.trim(), hash),
    false,
  );
});

test('PasswordService: distingue mayúsculas y conserva caracteres Unicode', async () => {
  const service = new PasswordService();
  const password = 'Construcción-Ñ-🔐';
  const hash = await service.generarHash(password);

  assert.equal(
    await service.verificar(password, hash),
    true,
  );

  assert.equal(
    await service.verificar(password.toLowerCase(), hash),
    false,
  );
});

test('PasswordService: propaga el error de un hash malformado', async () => {
  const service = new PasswordService();

  /**
   * Un dato almacenado corrupto representa un fallo técnico.
   * No debe convertirse silenciosamente en "contraseña incorrecta".
   *
   * No comprobamos el mensaje exacto porque pertenece a la biblioteca
   * y puede cambiar entre versiones.
   */
  await assert.rejects(
    () =>
      service.verificar(
        'Clave ficticia',
        'esto-no-es-un-hash-argon2',
      ),
    (error) => {
      assert.ok(error instanceof Error);
      return true;
    },
  );
});