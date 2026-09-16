require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PDFDocument } = require('pdf-lib');

const {
    conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
    DatabaseService,
} = require('../../dist/database/database.service');

const {
    PasswordService,
} = require('../../dist/modules/auth/services/password.service');

const {
    AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

const {
    PlanosSubidaService,
} = require('../../dist/modules/planos/planos-subida.service');

/**
 * Comprueba autenticación, validación, permisos, páginas e inserción real.
 *
 * El PDF se guarda en la carpeta temporal del ayudante.
 * Los registros de PostgreSQL se limpian al terminar.
 */
test('incidencias HTTP: crea en una página válida y rechaza páginas inexistentes y accesos retirados', async () => {
    await conAplicacionReal(async ({ app, baseUrl, origen }) => {
        const database = app.get(DatabaseService);
        const passwords = app.get(PasswordService);
        const subida = app.get(PlanosSubidaService);

        const propietario = randomUUID();
        const colaborador = randomUUID();
        const proyecto = randomUUID();
        const usuarios = [propietario, colaborador];

        const password = 'Clave temporal de integración-2026';
        const hash = await passwords.generarHash(password);

        try {
            await database.withTransaction(async (client) => {
                for (const id of usuarios) {
                    await client.query(
                        `
              INSERT INTO obra.usuarios (
                id_usuario, correo, password_hash
              )
              VALUES ($1, $2, $3)
            `,
                        [id, `${id}@example.invalid`, hash],
                    );
                }

                await client.query(
                    `
            INSERT INTO obra.proyectos (
              id_proyecto, id_propietario, nombre, descripcion,
              direccion, contratante, fecha_inicio, estado_proyecto
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
                    [
                        proyecto,
                        propietario,
                        'Proyecto temporal',
                        'Creación de incidencias',
                        'Dirección temporal',
                        'Contratante temporal',
                        '2026-09-15',
                        'ACTIVA',
                    ],
                );

                await client.query(
                    `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1, $2)
          `,
                    [colaborador, proyecto],
                );
            });

            const documento = await PDFDocument.create();
            documento.addPage([200, 300]);
            documento.addPage([300, 200]);

            const plano = await subida.subir(
                proyecto,
                propietario,
                { titulo: 'Plano de dos páginas', descripcion: '' },
                Buffer.from(await documento.save()),
            );

            const login = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    Origin: origen,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    correo: `${colaborador}@example.invalid`,
                    password,
                }),
            });

            await login.json();
            assert.equal(login.status, 200);

            const cookieCompleta = login.headers
                .getSetCookie()
                .find((valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`));

            assert.ok(cookieCompleta);
            const cookie = cookieCompleta.split(';')[0];

            const datos = {
                titulo: 'Fisura en muro',
                descripcion: 'Revisar el punto señalado.',
                prioridad: 'ALTA',
                numero_pagina: 2,
                coordenada_x: 120.5,
                coordenada_y: 80.25,
            };

            async function crear(
                cambios = {},
                autenticado = true,
                idPlano = plano.id_plano,
            ) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/planos/${idPlano}/incidencias`,
                    {
                        method: 'POST',
                        headers: {
                            Origin: origen,
                            'Content-Type': 'application/json',
                            ...(autenticado ? { Cookie: cookie } : {}),
                        },
                        body: JSON.stringify({ ...datos, ...cambios }),
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            assert.equal((await crear({}, false)).status, 401);

            // El PDF tiene dos páginas: la última debe estar permitida.
            const creada = await crear();

            assert.equal(creada.status, 201);
            assert.equal(creada.cache, 'no-store');

            const incidencia = creada.cuerpo;

            assert.deepEqual(incidencia, {
                id_incidencia: incidencia.id_incidencia,
                id_proyecto: proyecto,
                id_plano: plano.id_plano,
                id_creador: colaborador,
                ...datos,
                estado: 'PENDIENTE',
                fecha_creacion: incidencia.fecha_creacion,
            });

            assert.match(
                incidencia.id_incidencia,
                /^[0-9a-f-]{36}$/,
            );
            assert.ok(Number.isFinite(Date.parse(incidencia.fecha_creacion)));

            const guardadas = await database.query(
                `
          SELECT *
          FROM obra.incidencias
          WHERE id_proyecto = $1
        `,
                [proyecto],
            );

            assert.equal(guardadas.rows.length, 1);

            const registro = guardadas.rows[0];

            assert.equal(registro.id_incidencia, incidencia.id_incidencia);
            assert.equal(registro.id_plano, plano.id_plano);
            assert.equal(registro.id_creador, colaborador);
            assert.equal(registro.estado, 'PENDIENTE');
            assert.equal(registro.prioridad, 'ALTA');
            assert.equal(registro.numero_pagina, 2);
            assert.equal(Number(registro.coordenada_x), datos.coordenada_x);
            assert.equal(Number(registro.coordenada_y), datos.coordenada_y);

            async function consultar(consulta, autenticado = true) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/planos/${plano.id_plano}/incidencias?${consulta}`,
                    {
                        headers: autenticado ? { Cookie: cookie } : {},
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            assert.equal(
                (await consultar('numero_pagina=2', false)).status,
                401,
            );

            const listado = await consultar('numero_pagina=2');

            assert.equal(listado.status, 200);
            assert.equal(listado.cache, 'no-store');
            assert.deepEqual(listado.cuerpo, {
                incidencias: [incidencia],
                numero_pagina: 2,
                pagina: 1,
                limite: 50,
                total: 1,
                total_paginas: 1,
            });

            // Una página válida sin incidencias devuelve una lista vacía.
            const paginaVacia = await consultar('numero_pagina=1');

            assert.equal(paginaVacia.status, 200);
            assert.deepEqual(paginaVacia.cuerpo, {
                incidencias: [],
                numero_pagina: 1,
                pagina: 1,
                limite: 50,
                total: 0,
                total_paginas: 0,
            });

            // Un desplazamiento sin resultados conserva el conteo total.
            const fueraDeResultados = await consultar(
                'numero_pagina=2&pagina=2&limite=1',
            );

            assert.equal(fueraDeResultados.status, 200);
            assert.deepEqual(fueraDeResultados.cuerpo, {
                incidencias: [],
                numero_pagina: 2,
                pagina: 2,
                limite: 1,
                total: 1,
                total_paginas: 1,
            });

            const paginaNoExiste = await consultar('numero_pagina=3');

            assert.equal(paginaNoExiste.status, 400);
            assert.equal(
                paginaNoExiste.cuerpo.message,
                'La página indicada no existe en el plano.',
            );

            // Comprueba también la validación real del controlador.
            assert.equal((await consultar('')).status, 400);
            assert.equal(
                (await consultar('numero_pagina=2&limite=101')).status,
                400,
            );
            assert.equal(
                (await consultar('numero_pagina=2&extra=1')).status,
                400,
            );

            const paginaInexistente = await crear({ numero_pagina: 3 });

            assert.equal(paginaInexistente.status, 400);
            assert.equal(
                paginaInexistente.cuerpo.message,
                'La página indicada no existe en el plano.',
            );

            // Un UUID válido no implica que exista el plano.
            assert.equal((await crear({}, true, randomUUID())).status, 404);

            // El cliente no puede escoger un creador ni un estado inicial.
            assert.equal(
                (await crear({ id_creador: propietario })).status,
                400,
            );
            assert.equal(
                (await crear({ estado: 'SOLUCIONADA' })).status,
                400,
            );

            const datosEdicion = {
                titulo: 'Fisura revisada',
                descripcion: 'Reparación verificada.',
                prioridad: 'BAJA',
                estado: 'SOLUCIONADA',
            };

            async function editar(cambios = {}) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/planos/${plano.id_plano}/incidencias/${incidencia.id_incidencia}`,
                    {
                        method: 'PATCH',
                        headers: {
                            Origin: origen,
                            Cookie: cookie,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ ...datosEdicion, ...cambios }),
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            const editada = await editar();

            assert.equal(editada.status, 200);
            assert.equal(editada.cache, 'no-store');

            // Los campos ajenos a esta edición deben conservarse.
            assert.deepEqual(editada.cuerpo, {
                ...incidencia,
                ...datosEdicion,
            });

            const registrosEditados = await database.query(
                `
          SELECT *
          FROM obra.incidencias
          WHERE id_incidencia = $1
        `,
                [incidencia.id_incidencia],
            );

            assert.deepEqual(registrosEditados.rows, [{
                ...registro,
                ...datosEdicion,
            }]);

            const listadoTrasEditar = await consultar('numero_pagina=2');

            assert.equal(listadoTrasEditar.status, 200);
            assert.deepEqual(
                listadoTrasEditar.cuerpo.incidencias,
                [editada.cuerpo],
            );

            // La ruta debe rechazar cambios de autoría y del marcador.
            assert.equal(
                (await editar({ id_creador: propietario })).status,
                400,
            );
            assert.equal(
                (await editar({ numero_pagina: 1 })).status,
                400,
            );
            assert.equal(
                (await editar({ coordenada_x: 0 })).status,
                400,
            );

            const historialEdicion = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'INCIDENCIA_DATOS_GUARDADOS'
        `,
                [proyecto],
            );

            assert.deepEqual(historialEdicion.rows, [{
                id_actor: colaborador,
                tipo_accion: 'INCIDENCIA_DATOS_GUARDADOS',
                mensaje:
                    `Datos de la incidencia ${incidencia.id_incidencia} guardados.`,
            }]);

            await database.query(
                `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
                [colaborador, proyecto],
            );

            assert.equal((await crear()).status, 404);

            const edicionSinAcceso = await editar({
                titulo: 'Cambio que debe rechazarse',
            });

            assert.equal(edicionSinAcceso.status, 404);

            const listadoSinAcceso = await consultar('numero_pagina=2');

            assert.equal(listadoSinAcceso.status, 404);
            assert.equal(
                listadoSinAcceso.cuerpo.message,
                'El plano no está disponible.',
            );

            /*
             * Sin acceso tampoco se debe revelar si una página existe.
             * La autorización tiene prioridad sobre esa comprobación.
             */
            assert.equal(
                (await consultar('numero_pagina=999')).status,
                404,
            );

            // Ningún intento rechazado debe insertar una incidencia adicional.
            const posteriores = await database.query(
                'SELECT * FROM obra.incidencias WHERE id_proyecto = $1',
                [proyecto],
            );

            assert.deepEqual(posteriores.rows, registrosEditados.rows);

            // Los intentos rechazados no deben crear actividades de edición.
            const historialEdicionFinal = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'INCIDENCIA_DATOS_GUARDADOS'
        `,
                [proyecto],
            );

            assert.deepEqual(
                historialEdicionFinal.rows,
                historialEdicion.rows,
            );

            const actividades = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'INCIDENCIA_CREADA'
        `,
                [proyecto],
            );

            assert.deepEqual(actividades.rows, [{
                id_actor: colaborador,
                tipo_accion: 'INCIDENCIA_CREADA',
                mensaje:
                    `Incidencia ${incidencia.id_incidencia} creada en el plano ${plano.id_plano}.`,


            }]);

            /*
 * Restablecemos la colaboración retirada anteriormente.
 * El creador necesita conservar acceso para eliminar su incidencia.
 */
            await database.query(
                `
          INSERT INTO obra.usuario_proyecto (
            id_usuario, id_proyecto
          )
          VALUES ($1, $2)
        `,
                [colaborador, proyecto],
            );

            const loginPropietario = await fetch(
                `${baseUrl}/api/auth/login`,
                {
                    method: 'POST',
                    headers: {
                        Origin: origen,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        correo: `${propietario}@example.invalid`,
                        password,
                    }),
                },
            );

            await loginPropietario.json();
            assert.equal(loginPropietario.status, 200);

            const cookiePropietarioCompleta = loginPropietario.headers
                .getSetCookie()
                .find((valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`));

            assert.ok(cookiePropietarioCompleta);
            const cookiePropietario = cookiePropietarioCompleta.split(';')[0];

            const rutaEliminacion =
                `${baseUrl}/api/proyectos/${proyecto}/planos/${plano.id_plano}/incidencias/${incidencia.id_incidencia}`;

            async function eliminar(cookieSesion) {
                return fetch(rutaEliminacion, {
                    method: 'DELETE',
                    headers: {
                        Origin: origen,
                        ...(cookieSesion ? { Cookie: cookieSesion } : {}),
                    },
                });
            }

            const sinSesion = await eliminar();
            await sinSesion.json();
            assert.equal(sinSesion.status, 401);

            // Ser propietario no permite borrar directamente una incidencia ajena.
            const intentoPropietario = await eliminar(cookiePropietario);
            const rechazoPropietario = await intentoPropietario.json();

            assert.equal(intentoPropietario.status, 404);
            assert.equal(
                rechazoPropietario.message,
                'La incidencia no está disponible.',
            );

            const conservada = await database.query(
                'SELECT * FROM obra.incidencias WHERE id_incidencia = $1',
                [incidencia.id_incidencia],
            );

            assert.deepEqual(conservada.rows, registrosEditados.rows);

            const actividadAntes = await database.query(
                `
          SELECT id_actividad
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'INCIDENCIA_ELIMINADA'
        `,
                [proyecto],
            );

            assert.equal(actividadAntes.rows.length, 0);

            // El colaborador es el creador y ha recuperado su acceso.
            const eliminada = await eliminar(cookie);

            assert.equal(eliminada.status, 204);
            assert.equal(
                eliminada.headers.get('cache-control'),
                'no-store',
            );
            assert.equal(await eliminada.text(), '');

            const restantes = await database.query(
                'SELECT id_incidencia FROM obra.incidencias WHERE id_incidencia = $1',
                [incidencia.id_incidencia],
            );

            assert.equal(restantes.rows.length, 0);

            // La eliminación individual no debe eliminar el plano.
            const planoConservado = await database.query(
                'SELECT id_plano FROM obra.planos WHERE id_plano = $1',
                [plano.id_plano],
            );

            assert.deepEqual(planoConservado.rows, [{
                id_plano: plano.id_plano,
            }]);

            const listadoFinal = await consultar('numero_pagina=2');

            assert.equal(listadoFinal.status, 200);
            assert.equal(listadoFinal.cuerpo.total, 0);
            assert.deepEqual(listadoFinal.cuerpo.incidencias, []);

            // Repetir la solicitud no debe crear otra actividad.
            const repetida = await eliminar(cookie);
            await repetida.json();
            assert.equal(repetida.status, 404);

            const actividadEliminacion = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'INCIDENCIA_ELIMINADA'
        `,
                [proyecto],
            );

            assert.deepEqual(actividadEliminacion.rows, [{
                id_actor: colaborador,
                tipo_accion: 'INCIDENCIA_ELIMINADA',
                mensaje: `Incidencia ${incidencia.id_incidencia} eliminada.`,
            }]);
        } finally {
            await database.withTransaction(async (client) => {
                await client.query(
                    'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
                    [proyecto],
                );

                await client.query(
                    'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
                    [usuarios],
                );
            });
        }
    });
});