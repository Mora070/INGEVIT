require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { JwtService } = require('@nestjs/jwt');
const { UnauthorizedException } = require('@nestjs/common');

const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');

const {
  getAuthConfig,
  AUTH_TOKEN_TTL_SECONDS,
} = require('../dist/modules/auth/auth.config');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Crea una configuración independiente para cada prueba.
 *
 * Las claves se generan en memoria.
 * No leemos .env ni utilizamos secretos de la aplicación.
 */
function crearEscenario() {
  const config = getAuthConfig({
    AUTH_JWT_SECRET: randomBytes(32).toString('hex'),
  });

  const jwtService = new JwtService(config);
  const tokenService = new TokenService(jwtService);

  return { config, jwtService, tokenService };
}

test('getAuthConfig: rechaza claves ausentes o con formato incorrecto', () => {
  const valoresInvalidos = [
    undefined,
    '',
    ' ',
    'a'.repeat(63),
    'a'.repeat(65),
    'z'.repeat(64),
  ];

  for (const valor of valoresInvalidos) {
    assert.throws(
      () => getAuthConfig({ AUTH_JWT_SECRET: valor }),
      {
        message:
          'Configuración de autenticación inválida: ' +
          'AUTH_JWT_SECRET debe contener 64 caracteres hexadecimales.',
      },
    );
  }
});

test('TokenService: emite un token verificable con identidad, versión y vencimiento correctos', async () => {
  const { jwtService, tokenService } = crearEscenario();

  const token = await tokenService.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  // verifyAsync comprueba la firma y las opciones configuradas.
  // Decodificar sin verificar no sería suficiente.
  const payload = await jwtService.verifyAsync(token);

  assert.equal(payload.sub, ID_USUARIO);
  assert.equal(payload.version_sesion, 0);
  assert.equal(payload.iss, 'ingevit-backend');
  assert.equal(payload.aud, 'ingevit-api');

  assert.ok(Number.isInteger(payload.iat));
  assert.ok(Number.isInteger(payload.exp));
  assert.equal(
    payload.exp - payload.iat,
    AUTH_TOKEN_TTL_SECONDS,
  );

  // Detecta la incorporación accidental de datos adicionales.
  assert.deepEqual(
    Object.keys(payload).sort(),
    ['aud', 'exp', 'iat', 'iss', 'sub', 'version_sesion'],
  );
});

test('TokenService: el verificador rechaza una firma modificada', async () => {
  const { jwtService, tokenService } = crearEscenario();

  const token = await tokenService.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  const [header, payload, firma] = token.split('.');

  // Cambiamos el primer carácter para alterar realmente la firma.
  const primerCaracter = firma[0] === 'A' ? 'B' : 'A';
  const firmaModificada = primerCaracter + firma.slice(1);

  const tokenModificado =
    `${header}.${payload}.${firmaModificada}`;

  await assert.rejects(
    () => jwtService.verifyAsync(tokenModificado),
    { name: 'JsonWebTokenError' },
  );
});

test('TokenService: el verificador rechaza un token firmado con otra clave', async () => {
  const emisor = crearEscenario();
  const receptor = crearEscenario();

  const token = await emisor.tokenService.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  await assert.rejects(
    () => receptor.jwtService.verifyAsync(token),
    { name: 'JsonWebTokenError' },
  );
});

test('TokenService: el verificador rechaza un token vencido', async () => {
  const { config, jwtService } = crearEscenario();

  /**
   * Solo en esta prueba configuramos un vencimiento pasado.
   * Así comprobamos la expiración sin esperas artificiales.
   */
  const emisorVencido = new TokenService(
    new JwtService({
      ...config,
      signOptions: {
        ...config.signOptions,
        expiresIn: -1,
      },
    }),
  );

  const token = await emisorVencido.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  await assert.rejects(
    () => jwtService.verifyAsync(token),
    { name: 'TokenExpiredError' },
  );
});

test('TokenService: el verificador rechaza un emisor o destinatario diferente', async () => {
  const { config, jwtService } = crearEscenario();

  const configuracionesInvalidas = [
    { issuer: 'otro-backend' },
    { audience: 'otra-api' },
  ];

  for (const cambio of configuracionesInvalidas) {
    /**
     * Conservamos la misma clave para comprobar específicamente
     * el control del emisor y del destinatario.
     */
    const emisor = new TokenService(
      new JwtService({
        ...config,
        signOptions: {
          ...config.signOptions,
          ...cambio,
        },
      }),
    );

    const token = await emisor.emitirTokenConVersion(
      ID_USUARIO,
      0,
    );

    await assert.rejects(
      () => jwtService.verifyAsync(token),
      { name: 'JsonWebTokenError' },
    );
  }
});

/**
 * Comprueba el error público de un token rechazado.
 * Los detalles criptográficos no deben llegar al cliente.
 */
function comprobarSesionRechazada(error) {
  assert.ok(error instanceof UnauthorizedException);
  assert.equal(error.getStatus(), 401);
  assert.equal(
    error.message,
    'La sesión no es válida o ha expirado.',
  );

  return true;
}

test('verificarTokenConVersion: devuelve la identidad de un token válido', async () => {
  const { tokenService } = crearEscenario();

  const token = await tokenService.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  const identidad = await tokenService.verificarTokenConVersion(token);

  assert.deepEqual(identidad, {
    id_usuario: ID_USUARIO,
    version_sesion: 0,
  });
});

test('verificarTokenConVersion: rechaza una firma realizada con otra clave', async () => {
  const emisor = crearEscenario();
  const receptor = crearEscenario();

  const token = await emisor.tokenService.emitirTokenConVersion(
    ID_USUARIO,
    0,
  );

  await assert.rejects(
    () => receptor.tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: convierte un token vencido en un rechazo de sesión', async () => {
  const { jwtService, tokenService } = crearEscenario();

  // Vencimiento pasado para evitar esperas durante la prueba.
  const token = await jwtService.signAsync(
    { sub: ID_USUARIO, version_sesion: 0 },
    { expiresIn: -1 },
  );

  await assert.rejects(
    () => tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: rechaza un token que todavía no está vigente', async () => {
  const { jwtService, tokenService } = crearEscenario();

  const token = await jwtService.signAsync(
    { sub: ID_USUARIO, version_sesion: 0 },
    { notBefore: 60 },
  );

  await assert.rejects(
    () => tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: rechaza texto que no representa un JWT', async () => {
  const { tokenService } = crearEscenario();

  for (const token of ['', 'texto-invalido', 'uno.dos.tres']) {
    await assert.rejects(
      () => tokenService.verificarTokenConVersion(token),
      comprobarSesionRechazada,
    );
  }
});

test('verificarTokenConVersion: rechaza un emisor o destinatario incorrecto', async () => {
  const { jwtService, tokenService } = crearEscenario();

  for (const opciones of [
    { issuer: 'otro-backend' },
    { audience: 'otra-api' },
  ]) {
    const token = await jwtService.signAsync(
      { sub: ID_USUARIO, version_sesion: 0 },
      opciones,
    );

    await assert.rejects(
      () => tokenService.verificarTokenConVersion(token),
      comprobarSesionRechazada,
    );
  }
});

test('verificarTokenConVersion: rechaza un sujeto ausente o que no es un UUID', async () => {
  const { jwtService, tokenService } = crearEscenario();

  /**
   * Todos estos tokens tienen una firma válida.
   * El rechazo debe producirse por nuestro contrato de identidad.
   */
  const contenidosInvalidos = [
    {},
    { sub: '' },
    { sub: 'usuario-invalido' },
    { sub: 123 },
    { sub: null },
  ];

  for (const contenido of contenidosInvalidos) {
    const token = await jwtService.signAsync({
      ...contenido,
      version_sesion: 0,
    });

    await assert.rejects(
      () => tokenService.verificarTokenConVersion(token),
      comprobarSesionRechazada,
    );
  }
});

test('verificarTokenConVersion: rechaza un token firmado sin vencimiento', async () => {
  const { config, tokenService } = crearEscenario();

  /**
   * Eliminamos expiresIn únicamente del emisor de esta prueba.
   * Conservamos la clave, el algoritmo, el emisor y el destinatario.
   */
  const signOptions = { ...config.signOptions };
  delete signOptions.expiresIn;

  const emisorSinVencimiento = new JwtService({
    ...config,
    signOptions,
  });

  const token = await emisorSinVencimiento.signAsync({
    sub: ID_USUARIO,
    version_sesion: 0,
  });

  await assert.rejects(
    () => tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: rechaza un token firmado sin fecha de emisión', async () => {
  const { jwtService, tokenService } = crearEscenario();

  const token = await jwtService.signAsync(
    { sub: ID_USUARIO, version_sesion: 0 },
    { noTimestamp: true },
  );

  await assert.rejects(
    () => tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: rechaza un vencimiento anterior a la emisión', async () => {
  const { config, tokenService } = crearEscenario();

  const signOptions = { ...config.signOptions };
  delete signOptions.expiresIn;

  const emisor = new JwtService({
    ...config,
    signOptions,
  });

  const ahora = Math.floor(Date.now() / 1_000);

  /**
   * exp está en el futuro, por lo que no es un token expirado.
   * Sin embargo, exp es anterior a iat y viola nuestro contrato.
   */
  const token = await emisor.signAsync({
    sub: ID_USUARIO,
    version_sesion: 0,
    iat: ahora + 120,
    exp: ahora + 60,
  });

  await assert.rejects(
    () => tokenService.verificarTokenConVersion(token),
    comprobarSesionRechazada,
  );
});

test('verificarTokenConVersion: propaga fallos técnicos ajenos a la validación del JWT', async () => {
  const errorOriginal = new Error('Fallo técnico simulado');

  /**
   * Solo esta prueba sustituye JwtService.
   * Comprueba que no ocultamos cualquier fallo como un error 401.
   */
  const tokenService = new TokenService({
    async verifyAsync() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () => tokenService.verificarTokenConVersion('TOKEN_FICTICIO'),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});