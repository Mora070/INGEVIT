require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  Module,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const {
  ThrottlerGuard,
  ThrottlerModule,
} = require('@nestjs/throttler');
const cookieParser = require('cookie-parser');

const {
  CambiarPasswordController,
} = require('../dist/modules/auth/cambiar-password.controller');
const {
  CambiarPasswordService,
} = require('../dist/modules/auth/services/cambiar-password.service');
const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');
const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');
const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');
const {
  OriginGuard,
  AUTH_ALLOWED_ORIGINS,
} = require('../dist/modules/auth/guards/origin.guard');
const {
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');
const {
  getAuthRateLimitConfig,
} = require('../dist/modules/auth/auth-rate-limit.config');
const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ID = '20000000-0000-4000-8000-000000000001';
const TOKEN = 'token-ficticio';
const ORIGIN = 'http://127.0.0.1:3000';

function datosValidos() {
  return {
    password_actual: 'Contraseña anterior',
    password_nueva: 'Nueva frase de acceso',
  };
}

/**
 * Ejecuta la ruta y sus protecciones mediante HTTP real.
 *
 * El servicio de cambio se simula: no modifica contraseñas ni versiones.
 * Cada servidor tiene su propio almacenamiento del limitador.
 */
async function conServidor(ejecutar, { errorCambio } = {}) {
  const llamadas = [];
  const entornoAnterior = process.env.NODE_ENV;
  let app;

  try {
    process.env.NODE_ENV = 'test';

    class CambioPasswordHttpModule {}

    Module({
      imports: [
        ThrottlerModule.forRoot(getAuthRateLimitConfig()),
      ],
      controllers: [CambiarPasswordController],
      providers: [
        AuthGuard,
        ThrottlerGuard,
        {
          provide: AUTH_ALLOWED_ORIGINS,
          useValue: new Set([ORIGIN]),
        },
        {
          provide: APP_GUARD,
          useClass: OriginGuard,
        },
        {
          provide: TokenService,
          useValue: {
            async verificarTokenConVersion(token) {
              if (token !== TOKEN) {
                throw new UnauthorizedException();
              }

              return {
                id_usuario: ID,
                version_sesion: 0,
              };
            },
          },
        },
        {
          provide: UsuariosService,
          useValue: {
            async obtenerPerfilDeSesion(id, version) {
              assert.equal(id, ID);
              assert.equal(version, 0);

              return {
                id_usuario: ID,
                rol: 'USUARIO',
                estado: 'ACTIVO',
              };
            },
          },
        },
        {
          provide: CambiarPasswordService,
          useValue: {
            async cambiar(id, datos) {
              llamadas.push({
                id,
                datos: { ...datos },
              });

              if (errorCambio) {
                throw errorCambio;
              }
            },
          },
        },
      ],
    })(CambioPasswordHttpModule);

    app = await NestFactory.create(CambioPasswordHttpModule, {
      logger: false,
      abortOnError: false,
    });

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());

    await app.listen(0, '127.0.0.1');

    const direccion = app.getHttpServer().address();
    const url =
      `http://127.0.0.1:${direccion.port}/api/auth/cambiar-password`;

    async function cambiar({
      body = datosValidos(),
      token = TOKEN,
      origin = ORIGIN,
    } = {}) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      if (origin !== null) {
        headers.Origin = origin;
      }

      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    await ejecutar({ cambiar, llamadas });
  } finally {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      if (entornoAnterior === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = entornoAnterior;
      }
    }
  }
}

test('POST cambiar-password: utiliza la sesión y elimina la cookie después del éxito', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    const datos = {
      password_actual: '  Contraseña anterior  ',
      password_nueva: '  Nueva frase de acceso ñ  ',
    };

    const response = await cambiar({ body: datos });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '');

    assert.deepEqual(llamadas, [{
      id: ID,
      datos,
    }]);

    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie);

    assert.equal(
      cookie.split(';')[0],
      `${AUTH_COOKIE_NAME}=`,
    );

    assert.match(cookie, /Path=\//i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.doesNotMatch(cookie, /Max-Age=/i);

    const expires = /Expires=([^;]+)/i.exec(cookie);
    assert.ok(expires);
    assert.ok(Date.parse(expires[1]) < Date.now());
  });
});

test('POST cambiar-password: rechaza sesiones ausentes o inválidas sin borrar cookies', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    for (const token of [null, 'invalido']) {
      const response = await cambiar({ token });

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);
      await response.json();
    }

    assert.equal(llamadas.length, 0);
  });
});

test('POST cambiar-password: exige un origen autorizado', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    for (const origin of [null, 'https://otro.example']) {
      const response = await cambiar({ origin });

      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);
      await response.json();
    }

    assert.equal(llamadas.length, 0);
  });
});

test('POST cambiar-password: valida las contraseñas antes de invocar el servicio', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    for (const body of [
      {},
      { ...datosValidos(), password_actual: '' },
      { ...datosValidos(), password_actual: 123 },
      { ...datosValidos(), password_nueva: null },
      { ...datosValidos(), password_nueva: 'corta' },
      { ...datosValidos(), password_nueva: 'a'.repeat(129) },
    ]) {
      const response = await cambiar({ body });

      assert.equal(response.status, 400);
      assert.equal(response.headers.get('set-cookie'), null);
      await response.json();
    }

    assert.equal(llamadas.length, 0);
  });
});

test('POST cambiar-password: rechaza campos de identidad y autenticación adicionales', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    for (const campo of [
      'id_usuario',
      'rol',
      'password_hash',
      'version_sesion',
      'correo',
    ]) {
      const response = await cambiar({
        body: {
          ...datosValidos(),
          [campo]: 'valor-no-permitido',
        },
      });

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.equal(llamadas.length, 0);
  });
});

test('POST cambiar-password: conserva la cookie ante errores y no expone fallos internos', async () => {
  for (const [errorCambio, estado] of [
    [new BadRequestException('Contraseña repetida'), 400],
    [new UnauthorizedException('Contraseña incorrecta'), 401],
    [new ConflictException('Cambio concurrente'), 409],
    [new Error('detalle-interno-sensible'), 500],
  ]) {
    await conServidor(
      async ({ cambiar, llamadas }) => {
        const response = await cambiar();

        assert.equal(response.status, estado);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(llamadas.length, 1);

        const body = await response.json();

        assert.equal(
          JSON.stringify(body).includes('detalle-interno-sensible'),
          false,
        );
      },
      { errorCambio },
    );
  }
});

test('POST cambiar-password: limita las solicitudes antes de ejecutar otro cambio', async () => {
  await conServidor(async ({ cambiar, llamadas }) => {
    /*
     * El servicio simulado no invalida la sesión.
     * Esto permite comprobar exclusivamente el limitador de la ruta.
     */
    for (let numero = 0; numero < 10; numero += 1) {
      const response = await cambiar();

      assert.equal(response.status, 204);
      await response.text();
    }

    const bloqueada = await cambiar();

    assert.equal(bloqueada.status, 429);
    assert.equal(bloqueada.headers.get('set-cookie'), null);
    await bloqueada.json();

    assert.equal(llamadas.length, 10);
  });
});