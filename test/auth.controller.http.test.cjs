require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Module,
  UnauthorizedException,
  ConflictException,
} = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const {
  ThrottlerModule,
  ThrottlerGuard,
} = require('@nestjs/throttler');

const {
  AuthController,
} = require('../dist/modules/auth/auth.controller');
const {
  AuthService,
} = require('../dist/modules/auth/auth.service');
const {
  OriginGuard,
  AUTH_ALLOWED_ORIGINS,
} = require('../dist/modules/auth/guards/origin.guard');
const {
  getAuthRateLimitConfig,
} = require('../dist/modules/auth/auth-rate-limit.config');
const {
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');
const {
  AUTH_TOKEN_TTL_SECONDS,
} = require('../dist/modules/auth/auth.config');
const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const cookieParser = require('cookie-parser');


const ORIGIN = 'http://127.0.0.1:3000';
const TOKEN = 'TOKEN_FICTICIO_HTTP';

function crearPerfil() {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  };
}

/**
 * Inicia una aplicación HTTP aislada para cada prueba.
 *
 * Utiliza el controlador, los guards y el pipe reales.
 * Solo sustituye AuthService: no necesita PostgreSQL ni claves JWT.
 *
 * El puerto 0 permite que el sistema elija un puerto libre,
 * por lo que no interfiere con el backend del puerto 3000.
 *
 * Estas pruebas deben ejecutarse sin concurrencia dentro del archivo
 * porque el constructor del controlador consulta NODE_ENV.
 */
async function conServidor(operation, errorAutenticacion, errorPerfil, errorRegistro) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';

  const llamadas = [];
  const registros = [];
  let app;

  try {
    const authService = {
      async iniciarSesion(correo, password) {
        llamadas.push({ correo, password });

        if (errorAutenticacion) {
          throw errorAutenticacion;
        }

        return {
          tokenAcceso: TOKEN,
          usuario: crearPerfil(),
        };
      },

      /**
 * Simula el registro sin escribir en PostgreSQL.
 * Registra la entrada para comprobar la validación HTTP.
 */
      async registrar(datos) {
        registros.push(datos);

        if (errorRegistro) {
          throw errorRegistro;
        }

        return {
          ...crearPerfil(),
          correo: datos.correo,
          nombre: datos.nombre ?? null,
          apellidos: datos.apellidos ?? null,
          telefono: datos.telefono ?? null,
          ubicacion: datos.ubicacion ?? null,
        };
      },
    };



    class HttpTestModule { }

    // Aplicamos el decorador manualmente porque este archivo es JavaScript.
    Module({
      imports: [
        ThrottlerModule.forRoot(getAuthRateLimitConfig()),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: AUTH_ALLOWED_ORIGINS,
          useValue: new Set([ORIGIN]),
        },
        {
          provide: APP_GUARD,
          useClass: OriginGuard,
        },
        ThrottlerGuard,

        AuthGuard,

        /**
         * Dependencias simuladas de la ruta protegida.
         * La firma JWT real se comprueba en las pruebas de TokenService.
         */
        {
          provide: TokenService,
          useValue: {
            async verificarToken(token) {
              if (token !== TOKEN) {
                throw new UnauthorizedException(
                  'La sesión no es válida o ha expirado.',
                );
              }

              return crearPerfil().id_usuario;
            },
          },
        },
        {
          provide: UsuariosService,
          useValue: {
            async obtenerMiPerfil(idUsuario) {
              if (errorPerfil) {
                throw errorPerfil;
              }

              const perfil = crearPerfil();

              if (idUsuario !== perfil.id_usuario) {
                throw new UnauthorizedException(
                  'La sesión no es válida o la cuenta no está activa.',
                );
              }

              return perfil;
            }, //SSSSSSSSSSSS
          },
        },
      ],
    })(HttpTestModule);


    app = await NestFactory.create(HttpTestModule, {
      logger: false,
    });

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());

    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    const url = `http://127.0.0.1:${address.port}/api/auth/login`;

    /**
     * Permite omitir Origin explícitamente mediante undefined.
     * Todas las credenciales enviadas son ficticias.
     */
    async function enviar(body, origin) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (origin !== undefined) {
        headers.Origin = origin;
      }

      return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    /**
 * Consulta el perfil enviando opcionalmente una cookie.
 *
 * fetch en Node no conserva automáticamente las cookies recibidas.
 * Las proporcionamos explícitamente para controlar cada escenario.
 */
    async function consultarPerfil(cookie) {
      const headers = {};

      if (cookie !== undefined) {
        headers.Cookie = cookie;
      }

      const perfilUrl = new URL('/api/auth/me', url);

      return fetch(perfilUrl, {
        method: 'GET',
        headers,
      });
    }

    /**
 * Solicita el cierre de sesión.
 *
 * Permite controlar el origen y la cookie para comprobar
 * tanto la eliminación como los rechazos de seguridad.
 */
    async function cerrarSesion(origin, cookie) {
      const headers = {};

      if (origin !== undefined) {
        headers.Origin = origin;
      }

      if (cookie !== undefined) {
        headers.Cookie = cookie;
      }

      return fetch(new URL('/api/auth/logout', url), {
        method: 'POST',
        headers,
      });
    }

    async function registrarCuenta(body, origin) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (origin !== undefined) {
        headers.Origin = origin;
      }

      return fetch(new URL('/api/auth/register', url), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }


    await operation({ enviar, consultarPerfil, cerrarSesion,registrarCuenta, llamadas, registros });
  } finally {
    try {
      if (app) {
        await app.close();
      }
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  }
}






test('POST login: devuelve el perfil y entrega el token únicamente en una cookie', async () => {
  await conServidor(async ({ enviar, llamadas }) => {
    const response = await enviar(
      {
        correo: '  persona@example.test  ',
        password: '  Clave ficticia  ',
      },
      ORIGIN,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');

    const body = await response.json();
    assert.deepEqual(body, crearPerfil());
    assert.equal(JSON.stringify(body).includes(TOKEN), false);

    assert.deepEqual(llamadas, [
      {
        correo: 'persona@example.test',
        password: '  Clave ficticia  ',
      },
    ]);

    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie);

    const atributos = cookie.split(';').map((value) => value.trim());

    assert.equal(atributos[0], `${AUTH_COOKIE_NAME}=${TOKEN}`);
    assert.ok(atributos.includes('HttpOnly'));
    assert.ok(atributos.includes('SameSite=Strict'));
    assert.ok(atributos.includes('Path=/'));

    // Express convierte los milisegundos de maxAge a segundos HTTP.
    assert.ok(
      atributos.includes(`Max-Age=${AUTH_TOKEN_TTL_SECONDS}`),
    );

    // Este servidor de prueba utiliza HTTP local.
    assert.equal(atributos.includes('Secure'), false);
    assert.equal(
      atributos.some((value) => /^Domain=/i.test(value)),
      false,
    );
  });
});

test('POST login: rechaza un cuerpo inválido antes de llamar al servicio', async () => {
  await conServidor(async ({ enviar, llamadas }) => {
    const response = await enviar({}, ORIGIN);

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);

    const body = await response.json();
    assert.ok(Array.isArray(body.message));
    assert.deepEqual(llamadas, []);
  });
});

test('POST login: rechaza orígenes ausentes o no autorizados antes de autenticar', async () => {
  await conServidor(async ({ enviar, llamadas }) => {
    for (const origin of [undefined, 'https://otro.example.test']) {
      const response = await enviar(
        {
          correo: 'persona@example.test',
          password: 'Clave ficticia',
        },
        origin,
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        body.message,
        'El origen de la solicitud no está permitido.',
      );
    }

    assert.deepEqual(llamadas, []);
  });
});

test('POST login: devuelve 401 sin establecer una cookie cuando se rechazan las credenciales', async () => {
  await conServidor(
    async ({ enviar, llamadas }) => {
      const response = await enviar(
        {
          correo: 'persona@example.test',
          password: 'Clave ficticia',
        },
        ORIGIN,
      );

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(body.message, 'Correo o contraseña incorrectos.');
      assert.equal(llamadas.length, 1);
    },
    new UnauthorizedException('Correo o contraseña incorrectos.'),
  );
});

test('POST login: bloquea la solicitud número 11 sin volver a autenticar', async () => {
  await conServidor(async ({ enviar, llamadas }) => {
    const credenciales = {
      correo: 'persona@example.test',
      password: 'Clave ficticia',
    };

    for (let intento = 0; intento < 10; intento += 1) {
      const response = await enviar(credenciales, ORIGIN);

      assert.equal(response.status, 200);
      await response.json();
    }

    const bloqueada = await enviar(credenciales, ORIGIN);

    assert.equal(bloqueada.status, 429);
    assert.equal(bloqueada.headers.get('set-cookie'), null);

    const body = await bloqueada.json();
    assert.equal(
      body.message,
      'Demasiadas solicitudes de autenticación. Inténtalo más tarde.',
    );

    assert.ok(Number(bloqueada.headers.get('retry-after')) > 0);
    assert.equal(llamadas.length, 10);
  });
});

test('GET me: devuelve el perfil utilizando la cookie recibida en el login', async () => {
  await conServidor(async ({ enviar, consultarPerfil }) => {
    const loginResponse = await enviar(
      {
        correo: 'persona@example.test',
        password: 'Clave ficticia',
      },
      ORIGIN,
    );

    assert.equal(loginResponse.status, 200);
    await loginResponse.json();

    const setCookie = loginResponse.headers.get('set-cookie');
    assert.ok(setCookie);

    /**
     * El encabezado Cookie de una solicitud lleva nombre=valor.
     * Los atributos HttpOnly, Path y Max-Age pertenecen a Set-Cookie,
     * por lo que no los reenviamos.
     */
    const cookie = setCookie.split(';')[0];

    const response = await consultarPerfil(cookie);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');

    const body = await response.json();
    assert.deepEqual(body, crearPerfil());

    assert.equal(Object.hasOwn(body, 'password_hash'), false);
    assert.equal(Object.hasOwn(body, 'google_sub'), false);
    assert.equal(JSON.stringify(body).includes(TOKEN), false);

    // Consultar el perfil no renueva automáticamente la sesión.
    assert.equal(response.headers.get('set-cookie'), null);
  });
});

test('GET me: rechaza una solicitud sin cookie de acceso', async () => {
  await conServidor(async ({ consultarPerfil }) => {
    const response = await consultarPerfil();

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);

    const body = await response.json();
    assert.equal(
      body.message,
      'La sesión no es válida o ha expirado.',
    );
  });
});

test('GET me: rechaza una cookie vacía, incorrecta o con otro nombre', async () => {
  await conServidor(async ({ consultarPerfil }) => {
    const cookiesInvalidas = [
      `${AUTH_COOKIE_NAME}=`,
      `${AUTH_COOKIE_NAME}=TOKEN_INCORRECTO`,
      `otra_cookie=${TOKEN}`,
    ];

    for (const cookie of cookiesInvalidas) {
      const response = await consultarPerfil(cookie);

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        body.message,
        'La sesión no es válida o ha expirado.',
      );
    }
  });
});

test('GET me: rechaza una cuenta inactiva aunque el token sea aceptado', async () => {
  /**
   * Simulamos el rechazo que produce UsuariosService cuando
   * PostgreSQL indica que la cuenta ya no está disponible.
   */
  const errorPerfil = new UnauthorizedException(
    'La sesión no es válida o la cuenta no está activa.',
  );

  await conServidor(
    async ({ consultarPerfil }) => {
      const response = await consultarPerfil(
        `${AUTH_COOKIE_NAME}=${TOKEN}`,
      );

      assert.equal(response.status, 401);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        body.message,
        'La sesión no es válida o la cuenta no está activa.',
      );
    },
    undefined,
    errorPerfil,
  );
});

test('GET me: devuelve 500 sin exponer detalles internos si falla la consulta del perfil', async () => {
  const detalleInterno = 'DETALLE_INTERNO_FICTICIO_POSTGRESQL';

  await conServidor(
    async ({ consultarPerfil }) => {
      const response = await consultarPerfil(
        `${AUTH_COOKIE_NAME}=${TOKEN}`,
      );

      // Un fallo técnico no debe presentarse como credenciales incorrectas.
      assert.equal(response.status, 500);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();

      assert.equal(body.statusCode, 500);
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
    },
    undefined,
    new Error(detalleInterno),
  );
});


/**
 * Comprueba que la respuesta instruye al navegador para eliminar
 * la cookie, conservando su alcance y opciones de seguridad.
 */
async function comprobarCookieEliminada(response) {
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);

  const atributos = cookie.split(';').map((value) => value.trim());

  assert.equal(atributos[0], `${AUTH_COOKIE_NAME}=`);
  assert.ok(atributos.includes('Path=/'));
  assert.ok(atributos.includes('HttpOnly'));
  assert.ok(atributos.includes('SameSite=Strict'));

  const expires = atributos.find((value) =>
    value.startsWith('Expires='),
  );

  assert.ok(expires);

  const fechaExpiracion = Date.parse(
    expires.slice('Expires='.length),
  );

  assert.ok(Number.isFinite(fechaExpiracion));
  assert.ok(fechaExpiracion < Date.now());

  // No debe conservar la duración positiva configurada para el login.
  assert.equal(
    atributos.some((value) => /^Max-Age=/i.test(value)),
    false,
  );

  assert.equal(
    atributos.some((value) => /^Domain=/i.test(value)),
    false,
  );
}

test('POST logout: elimina la cookie sin necesitar una sesión previa', async () => {
  await conServidor(async ({ cerrarSesion, llamadas }) => {
    const response = await cerrarSesion(ORIGIN);

    await comprobarCookieEliminada(response);
    assert.deepEqual(llamadas, []);
  });
});

test('POST logout: permite limpiar una cookie inválida', async () => {
  await conServidor(async ({ cerrarSesion }) => {
    const response = await cerrarSesion(
      ORIGIN,
      `${AUTH_COOKIE_NAME}=TOKEN_INVALIDO`,
    );

    await comprobarCookieEliminada(response);
  });
});

test('POST logout: permite repetir el cierre de sesión', async () => {
  await conServidor(async ({ cerrarSesion }) => {
    for (let intento = 0; intento < 2; intento += 1) {
      const response = await cerrarSesion(ORIGIN);

      await comprobarCookieEliminada(response);
    }
  });
});

test('POST logout: rechaza un origen ausente o no autorizado sin eliminar la cookie', async () => {
  await conServidor(async ({ cerrarSesion }) => {
    for (const origin of [
      undefined,
      'null',
      'https://otro.example.test',
    ]) {
      const response = await cerrarSesion(
        origin,
        `${AUTH_COOKIE_NAME}=${TOKEN}`,
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        body.message,
        'El origen de la solicitud no está permitido.',
      );
    }
  });
});

test('POST logout: después de retirar la cookie, consultar el perfil devuelve 401', async () => {
  await conServidor(
    async ({ enviar, consultarPerfil, cerrarSesion }) => {
      const loginResponse = await enviar(
        {
          correo: 'persona@example.test',
          password: 'Clave ficticia',
        },
        ORIGIN,
      );

      assert.equal(loginResponse.status, 200);
      await loginResponse.json();

      const setCookie = loginResponse.headers.get('set-cookie');
      assert.ok(setCookie);

      const cookie = setCookie.split(';')[0];

      const perfilAntes = await consultarPerfil(cookie);
      assert.equal(perfilAntes.status, 200);
      await perfilAntes.json();

      const logoutResponse = await cerrarSesion(ORIGIN, cookie);
      await comprobarCookieEliminada(logoutResponse);

      /**
       * Simulamos que el navegador aplicó la eliminación:
       * la siguiente solicitud ya no incluye la cookie.
       *
       * Esto no comprueba revocación del JWT en el servidor.
       */
      const perfilDespues = await consultarPerfil();

      assert.equal(perfilDespues.status, 401);

      const body = await perfilDespues.json();
      assert.equal(
        body.message,
        'La sesión no es válida o ha expirado.',
      );
    },
  );
});

test('POST register: devuelve 201 y el perfil sin iniciar sesión', async () => {
  await conServidor(async ({ registrarCuenta, registros }) => {
    const response = await registrarCuenta(
      {
        correo: '  persona@example.test  ',
        password: '  Clave ficticia  ',
        nombre: 'Persona',
        apellidos: 'De prueba',
        telefono: '+57 03001234567',
        ubicacion: 'Bogotá',
      },
      ORIGIN,
    );

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);

    const body = await response.json();

    assert.deepEqual(body, {
      ...crearPerfil(),
      nombre: 'Persona',
      apellidos: 'De prueba',
      telefono: '+57 03001234567',
      ubicacion: 'Bogotá',
    });

    assert.equal(registros.length, 1);
    assert.equal(registros[0].correo, 'persona@example.test');
    assert.equal(registros[0].password, '  Clave ficticia  ');

    assert.equal(Object.hasOwn(body, 'password'), false);
    assert.equal(Object.hasOwn(body, 'password_hash'), false);
    assert.equal(Object.hasOwn(body, 'google_sub'), false);
    assert.equal(Object.hasOwn(body, 'tokenAcceso'), false);
  });
});

test('POST register: rechaza datos inválidos y campos internos antes de registrar', async () => {
  await conServidor(async ({ registrarCuenta, registros }) => {
    const credenciales = {
      correo: 'persona@example.test',
      password: 'Clave ficticia',
    };

    const entradasInvalidas = [
      {},
      { ...credenciales, rol: 'ADMINISTRADOR' },
      { ...credenciales, estado: 'ACTIVO' },
      { ...credenciales, password_hash: 'HASH_NO_AUTORIZADO' },
      { ...credenciales, google_sub: 'IDENTIDAD_NO_AUTORIZADA' },
    ];

    for (const entrada of entradasInvalidas) {
      const response = await registrarCuenta(entrada, ORIGIN);

      assert.equal(response.status, 400);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.ok(Array.isArray(body.message));
    }

    assert.deepEqual(registros, []);
  });
});

test('POST register: devuelve 409 cuando el servicio rechaza un correo duplicado', async () => {
  await conServidor(
    async ({ registrarCuenta, registros }) => {
      const response = await registrarCuenta(
        {
          correo: 'persona@example.test',
          password: 'Clave ficticia',
        },
        ORIGIN,
      );

      assert.equal(response.status, 409);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        body.message,
        'No se puede registrar una cuenta con ese correo.',
      );

      assert.equal(registros.length, 1);
    },
    undefined,
    undefined,
    new ConflictException(
      'No se puede registrar una cuenta con ese correo.',
    ),
  );
});

test('POST register: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(async ({ registrarCuenta, registros }) => {
    for (const origin of [undefined, 'https://otro.example.test']) {
      const response = await registrarCuenta(
        {
          correo: 'persona@example.test',
          password: 'Clave ficticia',
        },
        origin,
      );

      assert.equal(response.status, 403);
      assert.equal(response.headers.get('set-cookie'), null);
      await response.json();
    }

    assert.deepEqual(registros, []);
  });
});

test('POST register: bloquea la solicitud número 11 antes de llamar al servicio', async () => {
  await conServidor(async ({ registrarCuenta, registros }) => {
    /**
     * El servicio es simulado: estas solicitudes no crean usuarios.
     * Usamos correos distintos para representar intentos independientes.
     */
    for (let numero = 0; numero < 10; numero += 1) {
      const response = await registrarCuenta(
        {
          correo: `persona-${numero}@example.test`,
          password: 'Clave ficticia',
        },
        ORIGIN,
      );

      assert.equal(response.status, 201);
      await response.json();
    }

    const response = await registrarCuenta(
      {
        correo: 'persona-bloqueada@example.test',
        password: 'Clave ficticia',
      },
      ORIGIN,
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.ok(Number(response.headers.get('retry-after')) > 0);

    const body = await response.json();
    assert.equal(
      body.message,
      'Demasiadas solicitudes de autenticación. Inténtalo más tarde.',
    );

    assert.equal(registros.length, 10);
  });
});