require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Module,
  UnauthorizedException,
  NotFoundException,
} = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const cookieParser = require('cookie-parser');

const {
  ProyectosController,
} = require('../dist/modules/proyectos/proyectos.controller');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

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
  AUTH_COOKIE_NAME,
} = require('../dist/modules/auth/auth-cookie.config');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const TOKEN = 'TOKEN_PROYECTOS_FICTICIO';

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';

function crearDetalleProyecto() {
  return {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: 4.711,
    longitud: -74.0721,
  };
}

/**
 * Ejecuta el controlador, AuthGuard y ValidationPipe reales.
 *
 * Simula los servicios para aislar el contrato HTTP.
 * No consulta PostgreSQL ni utiliza una clave JWT.
 */
async function conServidor(
  operation,
  { errorPerfil, errorListado, errorDetalle } = {},
) {
  const llamadas = [];
  const consultasDetalle = [];
  let app;

  try {
    class ProyectosHttpTestModule { }

    Module({
      controllers: [ProyectosController],
      providers: [
        AuthGuard,
        {
          provide: TokenService,
          useValue: {
            async verificarToken(token) {
              if (token !== TOKEN) {
                throw new UnauthorizedException(
                  'La sesión no es válida o ha expirado.',
                );
              }

              return ID_USUARIO;
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

              return {
                id_usuario: idUsuario,
                rol: 'USUARIO',
                estado: 'ACTIVO',
              };
            },
          },
        },
{
  provide: ProyectosService,
  useValue: {
    async listarDisponibles(idUsuario, consulta) {
      llamadas.push({
        idUsuario,
        pagina: consulta.pagina,
        limite: consulta.limite,
      });

      if (errorListado) {
        throw errorListado;
      }

      return {
        proyectos: [],
        pagina: consulta.pagina,
        limite: consulta.limite,
        total: 0,
        total_paginas: 0,
      };
    },

    // Ambos métodos deben estar dentro de useValue.
    async obtenerDetalle(idProyecto, idUsuario) {
      consultasDetalle.push({ idProyecto, idUsuario });

      if (errorDetalle) {
        throw errorDetalle;
      }

      return crearDetalleProyecto();
    },
  },
},
      ],
    })(ProyectosHttpTestModule);

    app = await NestFactory.create(ProyectosHttpTestModule, {
      logger: false,
    });

    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(createValidationPipe());

    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    const baseUrl = `http://127.0.0.1:${address.port}/api/proyectos`;

    async function consultar(query = '', token = TOKEN) {
      const headers = {};

      // null permite omitir explícitamente la cookie.
      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      return fetch(`${baseUrl}${query}`, { headers });
    }

    async function consultarDetalle(
      idProyecto = ID_PROYECTO,
      token = TOKEN,
    ) {
      const headers = {};

      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      return fetch(
        `${baseUrl}/${encodeURIComponent(idProyecto)}`,
        { headers },
      );
    }

    await operation({ consultar, llamadas, consultarDetalle,consultasDetalle });
  } finally {
    if (app) {
      await app.close();
    }
  }
}

test('GET proyectos: utiliza la identidad autenticada y la paginación predeterminada', async () => {
  await conServidor(async ({ consultar, llamadas }) => {
    const response = await consultar();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);

    assert.deepEqual(await response.json(), {
      proyectos: [],
      pagina: 1,
      limite: 20,
      total: 0,
      total_paginas: 0,
    });

    assert.deepEqual(llamadas, [
      {
        idUsuario: ID_USUARIO,
        pagina: 1,
        limite: 20,
      },
    ]);
  });
});

test('GET proyectos: convierte la paginación de la URL a números', async () => {
  await conServidor(async ({ consultar, llamadas }) => {
    const response = await consultar('?pagina=3&limite=10');

    assert.equal(response.status, 200);
    await response.json();

    assert.deepEqual(llamadas, [
      {
        idUsuario: ID_USUARIO,
        pagina: 3,
        limite: 10,
      },
    ]);
  });
});

test('GET proyectos: rechaza solicitudes sin cookie o con token incorrecto', async () => {
  await conServidor(async ({ consultar, llamadas }) => {
    for (const token of [null, 'TOKEN_INCORRECTO']) {
      const response = await consultar('', token);

      assert.equal(response.status, 401);
      await response.json();
    }

    assert.deepEqual(llamadas, []);
  });
});

test('GET proyectos: no consulta proyectos cuando la cuenta está inactiva', async () => {
  await conServidor(
    async ({ consultar, llamadas }) => {
      const response = await consultar();

      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(
        body.message,
        'La sesión no es válida o la cuenta no está activa.',
      );

      assert.deepEqual(llamadas, []);
    },
    {
      errorPerfil: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('GET proyectos: rechaza paginación inválida antes de llamar al servicio', async () => {
  await conServidor(async ({ consultar, llamadas }) => {
    const consultasInvalidas = [
      '?pagina=0',
      '?pagina=1.5',
      '?pagina=',
      '?limite=101',
      '?limite=texto',
      '?pagina=1&pagina=2',
    ];

    for (const query of consultasInvalidas) {
      const response = await consultar(query);

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.deepEqual(llamadas, []);
  });
});

test('GET proyectos: rechaza parámetros que intentan ampliar el acceso', async () => {
  await conServidor(async ({ consultar, llamadas }) => {
    const consultasInvalidas = [
      '?id_usuario=20000000-0000-4000-8000-000000000002',
      '?rol=ADMINISTRADOR',
      '?incluir_eliminados=true',
    ];

    for (const query of consultasInvalidas) {
      const response = await consultar(query);

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.deepEqual(llamadas, []);
  });
});

test('GET proyectos: no expone detalles internos cuando falla el listado', async () => {
  const detalleInterno = 'DETALLE_INTERNO_FICTICIO_PROYECTOS';

  await conServidor(
    async ({ consultar, llamadas }) => {
      const response = await consultar();

      assert.equal(response.status, 500);

      const body = await response.json();
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
      assert.equal(llamadas.length, 1);
    },
    {
      errorListado: new Error(detalleInterno),
    },
  );
});


test('GET detalle proyecto: consulta con la identidad autenticada y devuelve el detalle', async () => {
  await conServidor(
    async ({ consultarDetalle, consultasDetalle }) => {
      const response = await consultarDetalle();

      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      );
      assert.equal(response.headers.get('set-cookie'), null);
      assert.deepEqual(
        await response.json(),
        crearDetalleProyecto(),
      );

      assert.deepEqual(consultasDetalle, [
        {
          idProyecto: ID_PROYECTO,
          idUsuario: ID_USUARIO,
        },
      ]);
    },
  );
});

test('GET detalle proyecto: rechaza una sesión ausente o inválida sin consultar el detalle', async () => {
  await conServidor(
    async ({ consultarDetalle, consultasDetalle }) => {
      for (const token of [null, 'TOKEN_INCORRECTO']) {
        const response = await consultarDetalle(
          ID_PROYECTO,
          token,
        );

        assert.equal(response.status, 401);
        await response.json();
      }

      assert.deepEqual(consultasDetalle, []);
    },
  );
});

test('GET detalle proyecto: rechaza un UUID malformado antes de llamar al servicio', async () => {
  await conServidor(
    async ({ consultarDetalle, consultasDetalle }) => {
      const response = await consultarDetalle(
        'identificador-invalido',
      );

      assert.equal(response.status, 400);
      await response.json();

      assert.deepEqual(consultasDetalle, []);
    },
  );
});

test('GET detalle proyecto: devuelve 404 cuando el proyecto no está disponible', async () => {
  await conServidor(
    async ({ consultarDetalle, consultasDetalle }) => {
      const response = await consultarDetalle();

      assert.equal(response.status, 404);

      const body = await response.json();
      assert.equal(
        body.message,
        'El proyecto no está disponible.',
      );

      assert.deepEqual(consultasDetalle, [
        {
          idProyecto: ID_PROYECTO,
          idUsuario: ID_USUARIO,
        },
      ]);
    },
    {
      errorDetalle: new NotFoundException(
        'El proyecto no está disponible.',
      ),
    },
  );
});

test('GET detalle proyecto: rechaza una cuenta inactiva antes de consultar el proyecto', async () => {
  await conServidor(
    async ({ consultarDetalle, consultasDetalle }) => {
      const response = await consultarDetalle();

      assert.equal(response.status, 401);
      await response.json();

      assert.deepEqual(consultasDetalle, []);
    },
    {
      errorPerfil: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('GET detalle proyecto: oculta los detalles internos de un fallo técnico', async () => {
  const detalleInterno = 'FALLO_INTERNO_FICTICIO_DEL_DETALLE';

  await conServidor(
    async ({ consultarDetalle }) => {
      const response = await consultarDetalle();

      assert.equal(response.status, 500);

      const body = await response.json();
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
    },
    {
      errorDetalle: new Error(detalleInterno),
    },
  );
});