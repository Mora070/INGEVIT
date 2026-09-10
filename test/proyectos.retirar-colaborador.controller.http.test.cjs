require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const { NotFoundException } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');

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
    ActividadesService,
} = require('../dist/modules/actividades/actividades.service');

const {
    FotografiasService,
} = require('../dist/modules/fotografias/fotografias.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_PROPIETARIO = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Prueba el controlador mediante peticiones HTTP reales.
 *
 * Simula la autenticación y el servicio: no conecta con PostgreSQL.
 * Las reglas de autorización y atomicidad se prueban por separado.
 */
async function conServidor(
    operacion,
    { errorServicio, establecerIdentidad = true } = {},
) {
    const llamadas = [];

    const servicioSimulado = {
        async retirarColaborador(idProyecto, idActor, idColaborador) {
            llamadas.push({
                idProyecto,
                idActor,
                idColaborador,
            });

            if (errorServicio) {
                throw errorServicio;
            }
        },
    };

    const guardSimulado = {
        canActivate(context) {
            const request = context.switchToHttp().getRequest();

            if (establecerIdentidad) {
                request.usuario = {
                    id_usuario: ID_PROPIETARIO,
                    rol: 'USUARIO',
                    estado: 'ACTIVO',
                };
            }

            return true;
        },
    };

    // Sustituye el guard del controlador antes de resolver sus dependencias.
    // Así no se construyen TokenService ni UsuariosService en estas pruebas.
    const moduloPrueba = await Test.createTestingModule({
        controllers: [ProyectosController],
        providers: [
            {
                provide: ActividadesService,
                useValue: {
                    async listarDisponibles() {
                        assert.fail(
                            'Esta prueba no debe consultar el historial de actividades.',
                        );
                    },
                },
            },

            {
                provide: FotografiasService,
                useValue: {
                    async listarDisponibles() {
                        assert.fail(
                            'Esta prueba no debe consultar fotografías.',
                        );
                    },
                },
            },
            {
                provide: ProyectosService,
                useValue: servicioSimulado,
            },
        ],
    })
        .overrideGuard(AuthGuard)
        .useValue(guardSimulado)
        .compile();

    const app = moduloPrueba.createNestApplication({
        logger: false,
    });

    try {
        app.setGlobalPrefix('api');
        await app.listen(0, '127.0.0.1');

        const direccion = app.getHttpServer().address();
        const baseUrl = `http://127.0.0.1:${direccion.port}`;

        async function retirar({
            idProyecto = ID_PROYECTO,
            idUsuario = ID_COLABORADOR,
        } = {}) {
            return fetch(
                `${baseUrl}/api/proyectos/${idProyecto}/colaboradores/${idUsuario}`,
                { method: 'DELETE' },
            );
        }

        await operacion({ retirar, llamadas });
    } finally {
        await app.close();
    }
}

test(
    'DELETE colaboradores: devuelve 204 y utiliza la identidad de la sesión',
    async () => {
        await conServidor(async ({ retirar, llamadas }) => {
            const respuesta = await retirar();

            assert.equal(respuesta.status, 204);
            assert.equal(await respuesta.text(), '');
            assert.equal(
                respuesta.headers.get('cache-control'),
                'no-store',
            );

            assert.deepEqual(llamadas, [
                {
                    idProyecto: ID_PROYECTO,
                    idActor: ID_PROPIETARIO,
                    idColaborador: ID_COLABORADOR,
                },
            ]);
        });
    },
);

test(
    'DELETE colaboradores: rechaza un identificador de proyecto inválido',
    async () => {
        await conServidor(async ({ retirar, llamadas }) => {
            const respuesta = await retirar({
                idProyecto: 'proyecto-invalido',
            });

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'DELETE colaboradores: rechaza un identificador de colaborador inválido',
    async () => {
        await conServidor(async ({ retirar, llamadas }) => {
            const respuesta = await retirar({
                idUsuario: 'usuario-invalido',
            });

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'DELETE colaboradores: la comprobación defensiva rechaza una identidad ausente',
    async () => {
        await conServidor(
            async ({ retirar, llamadas }) => {
                const respuesta = await retirar();

                assert.equal(respuesta.status, 401);

                const cuerpo = await respuesta.json();

                assert.equal(
                    cuerpo.message,
                    'La sesión no es válida o ha expirado.',
                );
                assert.deepEqual(llamadas, []);
            },
            { establecerIdentidad: false },
        );
    },
);

test(
    'DELETE colaboradores: conserva el rechazo del servicio para un proyecto no autorizado',
    async () => {
        const mensaje =
            'El proyecto no está disponible para gestionar colaboradores.';

        await conServidor(
            async ({ retirar, llamadas }) => {
                const respuesta = await retirar();

                assert.equal(respuesta.status, 404);

                const cuerpo = await respuesta.json();

                assert.equal(cuerpo.message, mensaje);
                assert.equal(llamadas.length, 1);
            },
            {
                errorServicio: new NotFoundException(mensaje),
            },
        );
    },
);

test(
    'DELETE colaboradores: oculta los detalles de un error interno',
    async () => {
        const detalleInterno = 'DETALLE_INTERNO_NO_PUBLICABLE';

        await conServidor(
            async ({ retirar, llamadas }) => {
                const respuesta = await retirar();

                assert.equal(respuesta.status, 500);

                const cuerpo = await respuesta.json();

                assert.equal(cuerpo.statusCode, 500);
                assert.equal(
                    JSON.stringify(cuerpo).includes(detalleInterno),
                    false,
                );
                assert.equal(llamadas.length, 1);
            },
            {
                errorServicio: new Error(detalleInterno),
            },
        );
    },
);