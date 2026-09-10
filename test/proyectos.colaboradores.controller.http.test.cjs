require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ValidationPipe,
    NotFoundException,
} = require('@nestjs/common');

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

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_PROPIETARIO = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

/**
 * Levanta únicamente el controlador y sus dependencias simuladas.
 *
 * No conecta con PostgreSQL ni genera tokens.
 * Cada prueba utiliza un puerto disponible y cierra su servidor al terminar.
 */
async function conServidor(operacion, { errorServicio } = {}) {
    const llamadas = [];

    const servicioSimulado = {
        async agregarColaborador(idProyecto, idActor, idColaborador) {
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

            // Simula exclusivamente la identidad que establece AuthGuard.
            request.usuario = {
                id_usuario: ID_PROPIETARIO,
                rol: 'USUARIO',
                estado: 'ACTIVO',
            };

            return true;
        },
    };

    /*
     * Sustituye explícitamente el guard asociado al controlador.
     * Nest utiliza guardSimulado sin construir AuthGuard ni sus dependencias.
     *
     * La sustitución solo afecta a este módulo de pruebas.
     */
    const moduloPrueba = await Test.createTestingModule({
        controllers: [ProyectosController],
        providers: [
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

        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
                forbidNonWhitelisted: true,
                forbidUnknownValues: true,
                transformOptions: {
                    enableImplicitConversion: false,
                },
                validationError: {
                    target: false,
                    value: false,
                },
            }),
        );

        await app.listen(0, '127.0.0.1');

        const direccion = app.getHttpServer().address();
        const baseUrl = `http://127.0.0.1:${direccion.port}`;

        async function agregar(
            cuerpo,
            { idProyecto = ID_PROYECTO } = {},
        ) {
            return fetch(
                `${baseUrl}/api/proyectos/${idProyecto}/colaboradores`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(cuerpo),
                },
            );
        }

        await operacion({ agregar, llamadas });
    } finally {
        await app.close();
    }
}

test(
    'POST colaboradores: devuelve 204 y utiliza la identidad de la sesión',
    async () => {
        await conServidor(async ({ agregar, llamadas }) => {
            const respuesta = await agregar({
                id_usuario: ID_COLABORADOR,
            });

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
    'POST colaboradores: rechaza un identificador de proyecto inválido',
    async () => {
        await conServidor(async ({ agregar, llamadas }) => {
            const respuesta = await agregar(
                { id_usuario: ID_COLABORADOR },
                { idProyecto: 'proyecto-invalido' },
            );

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'POST colaboradores: exige el identificador del colaborador',
    async () => {
        await conServidor(async ({ agregar, llamadas }) => {
            const respuesta = await agregar({});

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'POST colaboradores: rechaza un identificador de colaborador inválido',
    async () => {
        await conServidor(async ({ agregar, llamadas }) => {
            const respuesta = await agregar({
                id_usuario: 'usuario-invalido',
            });

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'POST colaboradores: impide enviar la identidad del actor en el cuerpo',
    async () => {
        await conServidor(async ({ agregar, llamadas }) => {
            const respuesta = await agregar({
                id_usuario: ID_COLABORADOR,
                id_actor: ID_COLABORADOR,
            });

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'POST colaboradores: conserva el rechazo del servicio para un proyecto no autorizado',
    async () => {
        const mensaje =
            'El proyecto no está disponible para gestionar colaboradores.';

        await conServidor(
            async ({ agregar, llamadas }) => {
                const respuesta = await agregar({
                    id_usuario: ID_COLABORADOR,
                });

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
    'POST colaboradores: oculta los detalles de un error interno del servicio',
    async () => {
        const detalleInterno = 'DETALLE_INTERNO_NO_PUBLICABLE';

        await conServidor(
            async ({ agregar, llamadas }) => {
                const respuesta = await agregar({
                    id_usuario: ID_COLABORADOR,
                });

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