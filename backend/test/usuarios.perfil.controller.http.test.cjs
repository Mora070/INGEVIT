require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Module, UnauthorizedException } = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
const cookieParser = require('cookie-parser');

const {
  UsuariosPerfilController,
} = require('../dist/modules/usuarios/usuarios-perfil.controller');
const {
  UsuariosService,
} = require('../dist/modules/usuarios/usuarios.service');
const {
  UsuariosRepository,
} = require('../dist/modules/usuarios/usuarios.repository');
const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');
const {
  TokenService,
} = require('../dist/modules/auth/services/token.service');
const {
  OriginGuard,
  AUTH_ALLOWED_ORIGINS,
} = require('../dist/modules/auth/guards/origin.guard');
const {
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');
const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ID = '20000000-0000-4000-8000-000000000001';
const ORIGIN = 'http://127.0.0.1:3000';
const TOKEN = 'token-de-prueba';

async function conServidor(ejecutar, { errorActualizacion } = {}) {
  const actualizaciones = [];

  const usuario = {
    id_usuario: ID,
    nombre: 'Ana',
    apellidos: 'Pérez',
    foto_perfil_url: null,
    correo: 'ana@example.invalid',
    telefono: '+57 300 000 0000',
    password_hash: 'hash-no-publico',
    fecha_creacion: new Date('2026-09-16T12:00:00Z'),
    ubicacion: 'Bogotá',
    rol: 'USUARIO',
    estado: 'ACTIVO',
    version_sesion: 0,
    google_sub: null,
  };

  let app;

  try {
    class PerfilHttpTestModule { }

    Module({
      controllers: [UsuariosPerfilController],
      providers: [
        UsuariosService,
        AuthGuard,
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
          provide: UsuariosRepository,
          useValue: {
            async findById(id) {
              assert.equal(id, ID);
              return { ...usuario };
            },

            async actualizarPerfil(id, datos) {
              actualizaciones.push({ id, datos });

              if (errorActualizacion) {
                throw errorActualizacion;
              }

              const cambios = Object.fromEntries(
                Object.entries(datos).filter(
                  ([, valor]) => valor !== undefined,
                ),
              );

              return { ...usuario, ...cambios };
            },
          },
        },
      ],
    })(PerfilHttpTestModule);

    app = await NestFactory.create(PerfilHttpTestModule, {
      logger: false,
      abortOnError: false,
    });

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());

    await app.listen(0, '127.0.0.1');

    const direccion = app.getHttpServer().address();
    const url = `http://127.0.0.1:${direccion.port}/api/usuarios/me/perfil`;

    async function actualizar({
      body = { nombre: 'Ana María' },
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
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
    }

    await ejecutar({ actualizar, actualizaciones });
  } finally {
    if (app) {
      await app.close();
    }
  }
}

test('PATCH perfil: actualiza la identidad autenticada y devuelve el perfil seguro', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar({
      body: { nombre: '  Ana María  ' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);

    assert.deepEqual(await response.json(), {
      id_usuario: ID,
      nombre: 'Ana María',
      apellidos: 'Pérez',
      foto_perfil_url: null,
      correo: 'ana@example.invalid',
      telefono: '+57 300 000 0000',
      fecha_creacion: '2026-09-16T12:00:00.000Z',
      ubicacion: 'Bogotá',
      rol: 'USUARIO',
      estado: 'ACTIVO',
    });

    assert.deepEqual(actualizaciones, [{
      id: ID,
      datos: {
        nombre: 'Ana María',
        apellidos: undefined,
        telefono: undefined,
        ubicacion: undefined,
      },
    }]);
  });
});

test('PATCH perfil: rechaza una sesión ausente o inválida', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    for (const token of [null, 'token-invalido']) {
      const response = await actualizar({ token });

      assert.equal(response.status, 401);
      await response.json();
    }

    assert.equal(actualizaciones.length, 0);
  });
});

test('PATCH perfil: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    for (const origin of [null, 'https://otro.example']) {
      const response = await actualizar({ origin });

      assert.equal(response.status, 403);
      await response.json();
    }

    assert.equal(actualizaciones.length, 0);
  });
});

test('PATCH perfil: rechaza una actualización vacía', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar({ body: {} });

    assert.equal(response.status, 400);
    await response.json();
    assert.equal(actualizaciones.length, 0);
  });
});

test('PATCH perfil: impide cambiar identidad, permisos y campos de autenticación', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    for (const campo of [
      'id_usuario',
      'rol',
      'estado',
      'correo',
      'password_hash',
      'google_sub',
      'foto_perfil_url',
    ]) {
      const response = await actualizar({
        body: {
          nombre: 'Ana María',
          [campo]: 'valor-no-permitido',
        },
      });

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.equal(actualizaciones.length, 0);
  });
});

test('PATCH perfil: rechaza tipos y longitudes inválidas', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    for (const body of [
      { nombre: 123 },
      { apellidos: [] },
      { telefono: true },
      { ubicacion: {} },
      { nombre: 'a'.repeat(101) },
      { ubicacion: 'texto\u0000' },
    ]) {
      const response = await actualizar({ body });

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.equal(actualizaciones.length, 0);
  });
});

test('PATCH perfil: permite borrar datos y conserva los campos omitidos', async () => {
  await conServidor(async ({ actualizar, actualizaciones }) => {
    const response = await actualizar({
      body: {
        telefono: null,
        ubicacion: '   ',
      },
    });

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.telefono, null);
    assert.equal(body.ubicacion, null);
    assert.equal(body.nombre, 'Ana');
    assert.equal(body.apellidos, 'Pérez');

    assert.deepEqual(actualizaciones[0].datos, {
      nombre: undefined,
      apellidos: undefined,
      telefono: null,
      ubicacion: null,
    });
  });
});

test('PATCH perfil: no expone errores internos del repositorio', async () => {
  await conServidor(
    async ({ actualizar, actualizaciones }) => {
      const response = await actualizar();

      assert.equal(response.status, 500);

      const body = await response.json();

      assert.equal(
        JSON.stringify(body).includes('detalle-interno-sensible'),
        false,
      );

      assert.equal(actualizaciones.length, 1);
    },
    {
      errorActualizacion: new Error('detalle-interno-sensible'),
    },
  );
});