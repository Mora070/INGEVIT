require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Module,
  UnauthorizedException,
  NotFoundException,
} = require('@nestjs/common');
const { NestFactory, APP_GUARD } = require('@nestjs/core');
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


const {
  OriginGuard,
  AUTH_ALLOWED_ORIGINS,
} = require('../dist/modules/auth/guards/origin.guard');

const ORIGIN = 'http://127.0.0.1:3000';

function crearEntradaProyecto(cambios = {}) {
  return {
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    estado_proyecto: 'ACTIVA',
    ...cambios,
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
  { errorPerfil, errorListado, errorDetalle, errorCreacion, errorActualizacion, errorEliminacion, } = {},
) {
  const llamadas = [];
  const consultasDetalle = [];
  const creaciones = [];
  const actualizaciones = [];
  const eliminaciones = [];
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
          provide: AUTH_ALLOWED_ORIGINS,
          useValue: new Set([ORIGIN]),
        },
        {
          provide: APP_GUARD,
          useClass: OriginGuard,
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

            async crear(idUsuario, datos) {
              creaciones.push({
                idUsuario,
                datos: { ...datos },
              });

              if (errorCreacion) {
                throw errorCreacion;
              }

              return {
                ...crearDetalleProyecto(),
                id_propietario: idUsuario,
                nombre: datos.nombre,
                descripcion: datos.descripcion,
                direccion: datos.direccion,
                contratante: datos.contratante,
                fecha_inicio: datos.fecha_inicio,
                fecha_finalizacion: datos.fecha_finalizacion ?? null,
                estado_proyecto: datos.estado_proyecto,
                activo: true,
                latitud: datos.latitud ?? null,
                longitud: datos.longitud ?? null,
              };
            },

            async actualizar(idProyecto, idUsuario, datos) {
              actualizaciones.push({
                idProyecto,
                idUsuario,
                datos: { ...datos },
              });

              if (errorActualizacion) {
                throw errorActualizacion;
              }

              return {
                ...crearDetalleProyecto(),
                id_proyecto: idProyecto,
                id_propietario: idUsuario,
                nombre: datos.nombre,
                descripcion: datos.descripcion,
                direccion: datos.direccion,
                contratante: datos.contratante,
                fecha_inicio: datos.fecha_inicio,
                fecha_finalizacion: datos.fecha_finalizacion ?? null,
                estado_proyecto: datos.estado_proyecto,
                latitud: datos.latitud ?? null,
                longitud: datos.longitud ?? null,
              };
            },

            async eliminarLogicamente(idProyecto, idUsuario) {
              eliminaciones.push({ idProyecto, idUsuario });

              if (errorEliminacion) {
                throw errorEliminacion;
              }
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

    async function crearProyectoHttp(
      body,
      { token = TOKEN, origin = ORIGIN } = {},
    ) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      if (origin !== null) {
        headers.Origin = origin;
      }

      return fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }

    async function actualizarProyectoHttp(
      body,
      {
        idProyecto = ID_PROYECTO,
        token = TOKEN,
        origin = ORIGIN,
      } = {},
    ) {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      if (origin !== null) {
        headers.Origin = origin;
      }

      return fetch(
        `${baseUrl}/${encodeURIComponent(idProyecto)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        },
      );
    }


    async function eliminarProyectoHttp({
      idProyecto = ID_PROYECTO,
      token = TOKEN,
      origin = ORIGIN,
    } = {}) {
      const headers = {};

      if (token !== null) {
        headers.Cookie = `${AUTH_COOKIE_NAME}=${token}`;
      }

      if (origin !== null) {
        headers.Origin = origin;
      }

      return fetch(
        `${baseUrl}/${encodeURIComponent(idProyecto)}`,
        {
          method: 'DELETE',
          headers,
        },
      );
    }

    await operation({ consultar, llamadas, consultarDetalle, consultasDetalle, crearProyectoHttp, creaciones, actualizarProyectoHttp, actualizaciones, eliminarProyectoHttp, eliminaciones, });
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


test('POST proyectos: devuelve 201 y utiliza al solicitante como propietario', async () => {
  await conServidor(async ({ crearProyectoHttp, creaciones }) => {
    const entrada = crearEntradaProyecto({
      latitud: 0,
      longitud: -74.0721,
    });

    const response = await crearProyectoHttp(entrada);

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);

    const body = await response.json();

    assert.deepEqual(body, {
      ...crearDetalleProyecto(),
      id_propietario: ID_USUARIO,
      fecha_finalizacion: null,
      latitud: 0,
      longitud: -74.0721,
    });

    assert.equal(creaciones.length, 1);
    assert.equal(creaciones[0].idUsuario, ID_USUARIO);
    assert.equal(creaciones[0].datos.nombre, entrada.nombre);
    assert.equal(creaciones[0].datos.latitud, 0);

    assert.equal(
      Object.hasOwn(creaciones[0].datos, 'id_propietario'),
      false,
    );
  });
});

test('POST proyectos: rechaza una sesión ausente o inválida antes de crear', async () => {
  await conServidor(async ({ crearProyectoHttp, creaciones }) => {
    for (const token of [null, 'TOKEN_INCORRECTO']) {
      const response = await crearProyectoHttp(
        crearEntradaProyecto(),
        { token },
      );

      assert.equal(response.status, 401);
      await response.json();
    }

    assert.deepEqual(creaciones, []);
  });
});

test('POST proyectos: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(async ({ crearProyectoHttp, creaciones }) => {
    for (const origin of [null, 'https://otro.example.test']) {
      const response = await crearProyectoHttp(
        crearEntradaProyecto(),
        { origin },
      );

      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(
        body.message,
        'El origen de la solicitud no está permitido.',
      );
    }

    assert.deepEqual(creaciones, []);
  });
});

test('POST proyectos: rechaza campos internos y datos inválidos antes de crear', async () => {
  await conServidor(async ({ crearProyectoHttp, creaciones }) => {
    const entradasInvalidas = [
      {},
      crearEntradaProyecto({
        id_propietario: '30000000-0000-4000-8000-000000000003',
      }),
      crearEntradaProyecto({ activo: false }),
      crearEntradaProyecto({ fecha_inicio: '2026-02-30' }),
      crearEntradaProyecto({ latitud: 4.711 }),
    ];

    for (const entrada of entradasInvalidas) {
      const response = await crearProyectoHttp(entrada);

      assert.equal(response.status, 400);
      await response.json();
    }

    assert.deepEqual(creaciones, []);
  });
});

test('POST proyectos: rechaza una cuenta inactiva desde el guard', async () => {
  await conServidor(
    async ({ crearProyectoHttp, creaciones }) => {
      const response = await crearProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 401);
      await response.json();

      assert.deepEqual(creaciones, []);
    },
    {
      errorPerfil: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('POST proyectos: respeta el rechazo de la cuenta al iniciar la transacción', async () => {
  await conServidor(
    async ({ crearProyectoHttp, creaciones }) => {
      const response = await crearProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(
        body.message,
        'La sesión no es válida o la cuenta no está activa.',
      );

      // La autenticación inicial pasó; el servicio rechazó la operación.
      assert.equal(creaciones.length, 1);
    },
    {
      errorCreacion: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('POST proyectos: devuelve 500 sin exponer detalles si falla la creación', async () => {
  const detalleInterno = 'FALLO_INTERNO_FICTICIO_DE_CREACION';

  await conServidor(
    async ({ crearProyectoHttp }) => {
      const response = await crearProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 500);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
    },
    {
      errorCreacion: new Error(detalleInterno),
    },
  );
});


test('PUT proyectos: transmite la identidad autenticada y devuelve el proyecto actualizado', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const entrada = crearEntradaProyecto({
        nombre: 'Proyecto actualizado',
        estado_proyecto: 'PAUSA',
        latitud: 0,
        longitud: 0,
      });

      const response = await actualizarProyectoHttp(entrada);

      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      );
      assert.equal(response.headers.get('set-cookie'), null);

      assert.deepEqual(await response.json(), {
        ...crearDetalleProyecto(),
        nombre: 'Proyecto actualizado',
        estado_proyecto: 'PAUSA',
        fecha_finalizacion: null,
        latitud: 0,
        longitud: 0,
      });

      assert.equal(actualizaciones.length, 1);
      assert.equal(actualizaciones[0].idProyecto, ID_PROYECTO);
      assert.equal(actualizaciones[0].idUsuario, ID_USUARIO);
      assert.equal(actualizaciones[0].datos.nombre, entrada.nombre);
    },
  );
});

test('PUT proyectos: exige una sesión válida antes de actualizar', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      for (const token of [null, 'TOKEN_INCORRECTO']) {
        const response = await actualizarProyectoHttp(
          crearEntradaProyecto(),
          { token },
        );

        assert.equal(response.status, 401);
        await response.json();
      }

      assert.deepEqual(actualizaciones, []);
    },
  );
});

test('PUT proyectos: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      for (const origin of [null, 'https://otro.example.test']) {
        const response = await actualizarProyectoHttp(
          crearEntradaProyecto(),
          { origin },
        );

        assert.equal(response.status, 403);
        await response.json();
      }

      assert.deepEqual(actualizaciones, []);
    },
  );
});

test('PUT proyectos: rechaza un UUID malformado antes de actualizar', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const response = await actualizarProyectoHttp(
        crearEntradaProyecto(),
        { idProyecto: 'identificador-invalido' },
      );

      assert.equal(response.status, 400);
      await response.json();

      assert.deepEqual(actualizaciones, []);
    },
  );
});

test('PUT proyectos: aplica las validaciones heredadas y rechaza campos protegidos', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const entradasInvalidas = [
        {},
        { nombre: 'Edición parcial no admitida por este PUT' },
        crearEntradaProyecto({
          fecha_inicio: '2026-02-30',
        }),
        crearEntradaProyecto({
          latitud: 4.711,
        }),
        crearEntradaProyecto({
          id_propietario: '30000000-0000-4000-8000-000000000003',
        }),
        crearEntradaProyecto({
          activo: false,
        }),
      ];

      for (const entrada of entradasInvalidas) {
        const response = await actualizarProyectoHttp(entrada);

        assert.equal(response.status, 400);
        await response.json();
      }

      assert.deepEqual(actualizaciones, []);
    },
  );
});

test('PUT proyectos: devuelve 404 si el servicio rechaza la edición', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const response = await actualizarProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 404);

      const body = await response.json();
      assert.equal(
        body.message,
        'El proyecto no está disponible para edición.',
      );

      assert.equal(actualizaciones.length, 1);
    },
    {
      errorActualizacion: new NotFoundException(
        'El proyecto no está disponible para edición.',
      ),
    },
  );
});

test('PUT proyectos: no invoca la actualización si el guard rechaza la cuenta', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const response = await actualizarProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 401);
      await response.json();

      assert.deepEqual(actualizaciones, []);
    },
    {
      errorPerfil: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('PUT proyectos: respeta el rechazo del propietario durante la transacción', async () => {
  await conServidor(
    async ({ actualizarProyectoHttp, actualizaciones }) => {
      const response = await actualizarProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 401);
      await response.json();

      assert.equal(actualizaciones.length, 1);
    },
    {
      errorActualizacion: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('PUT proyectos: oculta los detalles internos de un fallo técnico', async () => {
  const detalleInterno = 'FALLO_INTERNO_FICTICIO_DE_EDICION';

  await conServidor(
    async ({ actualizarProyectoHttp }) => {
      const response = await actualizarProyectoHttp(
        crearEntradaProyecto(),
      );

      assert.equal(response.status, 500);

      const body = await response.json();
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
    },
    {
      errorActualizacion: new Error(detalleInterno),
    },
  );
});

test('DELETE proyectos: utiliza la identidad autenticada y devuelve 204 sin cuerpo', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      const response = await eliminarProyectoHttp();

      assert.equal(response.status, 204);
      assert.equal(await response.text(), '');
      assert.equal(
        response.headers.get('cache-control'),
        'no-store',
      );
      assert.equal(response.headers.get('set-cookie'), null);

      assert.deepEqual(eliminaciones, [
        {
          idProyecto: ID_PROYECTO,
          idUsuario: ID_USUARIO,
        },
      ]);
    },
  );
});

test('DELETE proyectos: rechaza una sesión ausente o inválida antes de eliminar', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      for (const token of [null, 'TOKEN_INCORRECTO']) {
        const response = await eliminarProyectoHttp({ token });

        assert.equal(response.status, 401);
        await response.json();
      }

      assert.deepEqual(eliminaciones, []);
    },
  );
});

test('DELETE proyectos: rechaza un origen ausente o no autorizado', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      for (const origin of [null, 'https://otro.example.test']) {
        const response = await eliminarProyectoHttp({ origin });

        assert.equal(response.status, 403);

        const body = await response.json();
        assert.equal(
          body.message,
          'El origen de la solicitud no está permitido.',
        );
      }

      assert.deepEqual(eliminaciones, []);
    },
  );
});

test('DELETE proyectos: rechaza un UUID malformado antes de eliminar', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      const response = await eliminarProyectoHttp({
        idProyecto: 'identificador-invalido',
      });

      assert.equal(response.status, 400);
      await response.json();

      assert.deepEqual(eliminaciones, []);
    },
  );
});

test('DELETE proyectos: devuelve 404 cuando el proyecto no está disponible para eliminación', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      const response = await eliminarProyectoHttp();

      assert.equal(response.status, 404);

      const body = await response.json();
      assert.equal(
        body.message,
        'El proyecto no está disponible para eliminación.',
      );

      assert.deepEqual(eliminaciones, [
        {
          idProyecto: ID_PROYECTO,
          idUsuario: ID_USUARIO,
        },
      ]);
    },
    {
      errorEliminacion: new NotFoundException(
        'El proyecto no está disponible para eliminación.',
      ),
    },
  );
});

test('DELETE proyectos: no llama al servicio si el guard rechaza la cuenta', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      const response = await eliminarProyectoHttp();

      assert.equal(response.status, 401);
      await response.json();

      assert.deepEqual(eliminaciones, []);
    },
    {
      errorPerfil: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('DELETE proyectos: respeta el rechazo de la cuenta dentro de la transacción', async () => {
  await conServidor(
    async ({ eliminarProyectoHttp, eliminaciones }) => {
      const response = await eliminarProyectoHttp();

      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(
        body.message,
        'La sesión no es válida o la cuenta no está activa.',
      );

      assert.equal(eliminaciones.length, 1);
    },
    {
      errorEliminacion: new UnauthorizedException(
        'La sesión no es válida o la cuenta no está activa.',
      ),
    },
  );
});

test('DELETE proyectos: devuelve 500 sin exponer detalles si falla la operación', async () => {
  const detalleInterno = 'FALLO_INTERNO_FICTICIO_DE_ELIMINACION';

  await conServidor(
    async ({ eliminarProyectoHttp }) => {
      const response = await eliminarProyectoHttp();

      assert.equal(response.status, 500);
      assert.equal(response.headers.get('set-cookie'), null);

      const body = await response.json();
      assert.equal(
        JSON.stringify(body).includes(detalleInterno),
        false,
      );
      assert.equal(Object.hasOwn(body, 'stack'), false);
    },
    {
      errorEliminacion: new Error(detalleInterno),
    },
  );
});