require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ValidationPipe,
    NotFoundException,
} = require('@nestjs/common');

const { Test } = require('@nestjs/testing');
const { NestFactory } = require('@nestjs/core');

const {
    ProyectosController,
} = require('../dist/modules/proyectos/proyectos.controller');

const {
    ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const {
    ActividadesService,
} = require('../dist/modules/actividades/actividades.service');

const {
    FotografiasService,
} = require('../dist/modules/fotografias/fotografias.service');

const {
    FotografiasSubidaService,
} = require('../dist/modules/fotografias/fotografias-subida.service');

const {
    AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Ejecuta peticiones HTTP reales contra el controlador.
 *
 * La autenticación y los servicios están simulados.
 * No conecta con PostgreSQL ni accede a archivos.
 */
async function conServidor(
    operacion,
    { errorServicio, establecerIdentidad = true } = {},
) {
    const llamadas = [];

    const fotografiasService = {
        async listarDisponibles(idProyecto, idUsuario, consulta) {
            llamadas.push({
                idProyecto,
                idUsuario,
                pagina: consulta.pagina,
                limite: consulta.limite,
            });

            if (errorServicio) {
                throw errorServicio;
            }

            return {
                fotografias: [],
                pagina: consulta.pagina,
                limite: consulta.limite,
                total: 0,
                total_paginas: 0,
            };
        },
    };

    const guardSimulado = {
        canActivate(context) {
            const request = context.switchToHttp().getRequest();

            if (establecerIdentidad) {
                request.usuario = {
                    id_usuario: ID_USUARIO,
                    rol: 'USUARIO',
                    estado: 'ACTIVO',
                };
            }

            return true;
        },
    };

    class ModuloPrueba { }

    // Sustituimos explícitamente el guard del controlador.
    // Así Nest no construye AuthGuard ni sus dependencias reales.
    const moduloPrueba = await Test.createTestingModule({
        controllers: [ProyectosController],
        providers: [
            {
                provide: ProyectosService,
                useValue: {},
            },
            {
                provide: ActividadesService,
                useValue: {
                    async listarDisponibles() {
                        assert.fail(
                            'Esta ruta no debe consultar el historial.',
                        );
                    },
                },
            },
            {
                provide: FotografiasService,
                useValue: fotografiasService,
            },

            {
                provide: FotografiasSubidaService,
                useValue: {
                    /**
                     * Estas pruebas comprueban otras rutas del controlador.
                     * Una llamada a subir sería un comportamiento inesperado.
                     */
                    async subir() {
                        throw new Error(
                            'Esta prueba no debe ejecutar la subida de fotografías.',
                        );
                    },
                },
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

        async function consultar({
            idProyecto = ID_PROYECTO,
            query = '',
        } = {}) {
            return fetch(
                `${baseUrl}/api/proyectos/${idProyecto}/fotografias${query}`,
            );
        }

        await operacion({ consultar, llamadas });
    } finally {
        await app.close();
    }
}

test(
    'GET fotografías: utiliza la sesión y la paginación predeterminada',
    async () => {
        await conServidor(async ({ consultar, llamadas }) => {
            const respuesta = await consultar();

            assert.equal(respuesta.status, 200);
            assert.equal(
                respuesta.headers.get('cache-control'),
                'no-store',
            );

            assert.deepEqual(await respuesta.json(), {
                fotografias: [],
                pagina: 1,
                limite: 20,
                total: 0,
                total_paginas: 0,
            });

            assert.deepEqual(llamadas, [
                {
                    idProyecto: ID_PROYECTO,
                    idUsuario: ID_USUARIO,
                    pagina: 1,
                    limite: 20,
                },
            ]);
        });
    },
);

test(
    'GET fotografías: transforma la paginación recibida en números',
    async () => {
        await conServidor(async ({ consultar, llamadas }) => {
            const respuesta = await consultar({
                query: '?pagina=2&limite=12',
            });

            assert.equal(respuesta.status, 200);

            const cuerpo = await respuesta.json();

            assert.equal(cuerpo.pagina, 2);
            assert.equal(cuerpo.limite, 12);

            assert.deepEqual(llamadas, [
                {
                    idProyecto: ID_PROYECTO,
                    idUsuario: ID_USUARIO,
                    pagina: 2,
                    limite: 12,
                },
            ]);
        });
    },
);

const entradasInvalidas = [
    ['proyecto inválido', { idProyecto: 'invalido' }],
    ['página cero', { query: '?pagina=0' }],
    ['límite excesivo', { query: '?limite=101' }],
    ['parámetro adicional', { query: '?orden=asc' }],
];

for (const [descripcion, opciones] of entradasInvalidas) {
    test(
        `GET fotografías: rechaza ${descripcion} antes de consultar el servicio`,
        async () => {
            await conServidor(async ({ consultar, llamadas }) => {
                const respuesta = await consultar(opciones);

                assert.equal(respuesta.status, 400);
                assert.equal((await respuesta.json()).statusCode, 400);
                assert.deepEqual(llamadas, []);
            });
        },
    );
}

test(
    'GET fotografías: la comprobación defensiva rechaza una identidad ausente',
    async () => {
        await conServidor(
            async ({ consultar, llamadas }) => {
                const respuesta = await consultar();

                assert.equal(respuesta.status, 401);
                assert.equal(
                    (await respuesta.json()).message,
                    'La sesión no es válida o ha expirado.',
                );
                assert.deepEqual(llamadas, []);
            },
            { establecerIdentidad: false },
        );
    },
);

test(
    'GET fotografías: conserva el 404 de un proyecto no disponible',
    async () => {
        const mensaje = 'El proyecto no está disponible.';

        await conServidor(
            async ({ consultar, llamadas }) => {
                const respuesta = await consultar();

                assert.equal(respuesta.status, 404);
                assert.equal(
                    (await respuesta.json()).message,
                    mensaje,
                );
                assert.equal(llamadas.length, 1);
            },
            {
                errorServicio: new NotFoundException(mensaje),
            },
        );
    },
);

test(
    'GET fotografías: oculta los detalles de un error interno',
    async () => {
        const detalleInterno = 'DETALLE_INTERNO_NO_PUBLICABLE';

        await conServidor(
            async ({ consultar, llamadas }) => {
                const respuesta = await consultar();

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