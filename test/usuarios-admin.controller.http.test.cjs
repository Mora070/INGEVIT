require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Module,
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const cookieParser = require('cookie-parser');

const {
  UsuariosAdminController,
} = require('../dist/modules/administracion/usuarios-admin.controller');

const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  RolesGuard,
} = require('../dist/modules/auth/guards/roles.guard');

const {
  OriginGuard,
  AUTH_ALLOWED_ORIGINS,
} = require('../dist/modules/auth/guards/origin.guard');

const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');

const {
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ORIGIN = 'http://127.0.0.1:3000';
const TOKEN = 'TOKEN_ADMIN_FICTICIO';

// Distinguimos al solicitante de la cuenta que se modificará.
const ID_SOLICITANTE = '10000000-0000-4000-8000-000000000001';
const ID_DESTINO = '20000000-0000-4000-8000-000000000002';

function crearPerfil(idUsuario, rol, estado = 'ACTIVO') {
  return {
    id_usuario: idUsuario,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol,
    estado,
  };
}

/**
 * Ejecuta el controlador y los guards reales mediante HTTP.
 *
 * Simula los servicios para no modificar cuentas en PostgreSQL.
 * No necesita variables de entorno ni claves de autenticación.
 */
async function conServidor(
  operation,
  { rol = 'ADMINISTRADOR', errorActualizacion } = {},
) {
  const actualizaciones = [];
  let app;

  try {
    class AdminHttpTestModule {}

    Module({
      controllers: [UsuariosAdminController],
      providers: [
        AuthGuard,
        RolesGuard,
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
            async verificarToken(token) {
              if (token !== TOKEN) {
                throw new UnauthorizedException(
                  'La sesión no es válida o ha expirado.',
                );
              }

              return ID_SOLICITANTE;
            },
          },
        },
        {
          provide: UsuariosService,
          useValue: {
            async obtenerMiPerfil(idUsuario) {
              return crearPerfil(idUsuario, rol);
            },

            async actualizarEstado(idUsuario, estado) {
              actualizaciones.push({ idUsuario, estado });

              if (errorActualizacion) {
                throw errorActualizacion;
              }

              return crearPerfil(idUsuario, 'USUARIO', estado);
            },
          },
        },
      ],
    })(AdminHttpTestModule);

    app = await NestFactory.create(AdminHttpTestModule, {
      logger: false,
    });

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());

    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function actualizar({
      idUsuario = ID_DESTINO,
      body = { estado: 'INACTIVO' },
      conCookie = true,
      origin = ORIGIN,
    } = {}) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (conCookie) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${TOKEN}`;
      }

      // null permite probar explícitamente la ausencia del encabezado.
      if (origin !== null) {
        headers.Origin = origin;
      }

      return fetch(
        `${baseUrl}/api/admin/usuarios/${idUsuario}/estado`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        },
      );
    }

    await operation({ actualizar, actualizaciones });
  } finally {
    if (app) {
      await app.close();
    }
  }
}

test('PATCH estado: permite al administrador modificar la cuenta indicada', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);

    const body = await response.json();

    assert.deepEqual(
      body,
      crearPerfil(ID_DESTINO, 'USUARIO', 'INACTIVO'),
    );

    // Debe modificar al destinatario, no al administrador autenticado.
    assert.deepEqual(actualizaciones, [
      {
        idUsuario: ID_DESTINO,
        estado: 'INACTIVO',
      },
    ]);
  });
});

test('PATCH estado: rechaza solicitudes sin sesión', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar({ conCookie: false });

    assert.equal(response.status, 401);
    await response.json();

    assert.deepEqual(actualizaciones, []);
  });
});

test('PATCH estado: rechaza a un usuario sin rol administrador', async () => {
  await conServidor(
    async ({ actualizar, actualizaciones }) => {
      const response = await actualizar();

      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(
        body.message,
        'No tienes permisos para realizar esta operación.',
      );

      assert.deepEqual(actualizaciones, []);
    },
    { rol: 'USUARIO' },
  );
});

test('PATCH estado: rechaza un UUID malformado antes de actualizar', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar({
      idUsuario: 'identificador-invalido',
    });

    assert.equal(response.status, 400);
    await response.json();

    assert.deepEqual(actualizaciones, []);
  });
});

test('PATCH estado: rechaza estados inválidos y campos adicionales', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const entradasInvalidas = [
      {},
      { estado: 'PAUSA' },
      { estado: null },
      { estado: 'INACTIVO', rol: 'ADMINISTRADOR' },
    ];

    for (const body of entradasInvalidas) {
      const response = await actualizar({ body });

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.deepEqual(actualizaciones, []);
  });
});

test('PATCH estado: devuelve 404 cuando el usuario de destino no existe', async () => {
  await conServidor(
    async ({ actualizar, actualizaciones }) => {
      const response = await actualizar();

      assert.equal(response.status, 404);

      const body = await response.json();
      assert.equal(body.message, 'El usuario no existe.');

      assert.equal(actualizaciones.length, 1);
    },
    {
      errorActualizacion: new NotFoundException(
        'El usuario no existe.',
      ),
    },
  );
});

test('PATCH estado: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    for (const origin of [null, 'https://otro.example.test']) {
      const response = await actualizar({ origin });

      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(
        body.message,
        'El origen de la solicitud no está permitido.',
      );
    }

    assert.deepEqual(actualizaciones, []);
  });
});