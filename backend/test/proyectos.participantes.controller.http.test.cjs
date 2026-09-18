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

const {
    FotografiasSubidaService,
} = require('../dist/modules/fotografias/fotografias-subida.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_SOLICITANTE = '10000000-0000-4000-8000-000000000001';
const ID_COLABORADOR = '30000000-0000-4000-8000-000000000003';

function crearParticipantes() {
    return [
        {
            id_usuario: ID_SOLICITANTE,
            nombre: 'Nombre propietario',
            apellidos: 'Apellido propietario',
            foto_perfil_url: null,
            participacion: 'PROPIETARIO',
        },
        {
            id_usuario: ID_COLABORADOR,
            nombre: null,
            apellidos: null,
            foto_perfil_url: null,
            participacion: 'COLABORADOR',
        },
    ];
}

/**
 * Levanta el controlador con autenticación y servicio simulados.
 *
 * Las peticiones HTTP son reales, pero no se utilizan tokens ni PostgreSQL.
 * La autorización del proyecto se verifica en las pruebas del repositorio.
 */
async function conServidor(
    operacion,
    { errorServicio, establecerIdentidad = true } = {},
) {
    const llamadas = [];
    const participantes = crearParticipantes();

    const servicioSimulado = {
        async listarParticipantes(idProyecto, idUsuario) {
            llamadas.push({ idProyecto, idUsuario });

            if (errorServicio) {
                throw errorServicio;
            }

            return participantes;
        },
    };

    const guardSimulado = {
        canActivate(context) {
            const request = context.switchToHttp().getRequest();

            if (establecerIdentidad) {
                request.usuario = {
                    id_usuario: ID_SOLICITANTE,
                    rol: 'USUARIO',
                    estado: 'ACTIVO',
                };
            }

            return true;
        },
    };

    /*
     * Sustituimos explícitamente el guard asociado al controlador.
     * Nest no necesita construir AuthGuard ni resolver sus dependencias.
     */
    const modulo = await Test.createTestingModule({
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

    const app = modulo.createNestApplication({
        logger: false,
    });

    try {
        app.setGlobalPrefix('api');
        await app.listen(0, '127.0.0.1');

        const direccion = app.getHttpServer().address();
        const baseUrl = `http://127.0.0.1:${direccion.port}`;

        async function consultar(idProyecto = ID_PROYECTO) {
            return fetch(
                `${baseUrl}/api/proyectos/${idProyecto}/participantes`,
            );
        }

        await operacion({ consultar, llamadas, participantes });
    } finally {
        await app.close();
    }
}

test(
    'GET participantes: devuelve 200 y consulta con la identidad de la sesión',
    async () => {
        await conServidor(
            async ({ consultar, llamadas, participantes }) => {
                const respuesta = await consultar();

                assert.equal(respuesta.status, 200);
                assert.equal(
                    respuesta.headers.get('cache-control'),
                    'no-store',
                );

                assert.deepEqual(
                    await respuesta.json(),
                    participantes,
                );

                assert.deepEqual(llamadas, [
                    {
                        idProyecto: ID_PROYECTO,
                        idUsuario: ID_SOLICITANTE,
                    },
                ]);
            },
        );
    },
);

test(
    'GET participantes: rechaza un identificador de proyecto inválido',
    async () => {
        await conServidor(async ({ consultar, llamadas }) => {
            const respuesta = await consultar('proyecto-invalido');

            assert.equal(respuesta.status, 400);
            assert.equal((await respuesta.json()).statusCode, 400);
            assert.deepEqual(llamadas, []);
        });
    },
);

test(
    'GET participantes: la comprobación defensiva rechaza una identidad ausente',
    async () => {
        await conServidor(
            async ({ consultar, llamadas }) => {
                const respuesta = await consultar();

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
    'GET participantes: conserva el 404 de un proyecto no disponible',
    async () => {
        const mensaje = 'El proyecto no está disponible.';

        await conServidor(
            async ({ consultar, llamadas }) => {
                const respuesta = await consultar();

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
    'GET participantes: oculta los detalles de un error interno',
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