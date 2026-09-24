require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

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
    ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

/**
 * Verifica sesión, permisos, orden y paginación por HTTP.
 * Los registros son exclusivos de la prueba; no crea GeoTIFF ni usa Mapbox.
 */
test('capas HTTP: lista por orden y restringe el acceso al proyecto', async (t) => {
    await conAplicacionReal(async ({ app, baseUrl, origen }) => {
        const database = app.get(DatabaseService);
        const passwords = app.get(PasswordService);

        const propietario = randomUUID();
        const colaborador = randomUUID();
        const ajeno = randomUUID();
        const proyecto = randomUUID();
        const otroProyecto = randomUUID();
        const usuarios = [propietario, colaborador, ajeno];

        const password = 'Clave temporal de integración-2026';
        const hash = await passwords.generarHash(password);

        try {
            await database.withTransaction(async (client) => {
                for (const usuario of usuarios) {
                    await client.query(
                        `
              INSERT INTO obra.usuarios (id_usuario, correo, password_hash)
              VALUES ($1, $2, $3)
            `,
                        [usuario, `${usuario}@example.invalid`, hash],
                    );
                }

                for (const id of [proyecto, otroProyecto]) {
                    await client.query(
                        `
              INSERT INTO obra.proyectos (
                id_proyecto, id_propietario, nombre, descripcion,
                direccion, contratante, fecha_inicio, estado_proyecto
              )
              VALUES (
                $1, $2, 'Proyecto capas HTTP', 'Consulta de capas',
                'Dirección temporal', 'Contratante temporal',
                '2026-09-22', 'ACTIVA'
              )
            `,
                        [id, propietario],
                    );
                }

                await client.query(
                    `
            INSERT INTO obra.usuario_proyecto (id_usuario, id_proyecto)
            VALUES ($1, $2)
          `,
                    [colaborador, proyecto],
                );
            });

            async function login(usuario) {
                const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        Origin: origen,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        correo: `${usuario}@example.invalid`,
                        password,
                    }),
                });

                await respuesta.json();
                assert.equal(respuesta.status, 200);

                const cookie = respuesta.headers.getSetCookie().find(
                    (valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`),
                );

                assert.ok(cookie);
                return cookie.split(';')[0];
            }

            const cookiePropietario = await login(propietario);
            const cookieColaborador = await login(colaborador);
            const cookieAjeno = await login(ajeno);

            async function listar(cookie, consulta = '', idProyecto = proyecto) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${idProyecto}/capas${consulta}`,
                    { headers: cookie ? { Cookie: cookie } : {} },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            assert.equal((await listar()).status, 401);
            assert.equal((await listar(cookieAjeno)).status, 404);
            assert.equal(
                (await listar(cookiePropietario, '', randomUUID())).status,
                404,
            );

            const vacio = await listar(cookieColaborador);

            assert.equal(vacio.status, 200);
            assert.deepEqual(vacio.cuerpo, {
                capas: [],
                pagina: 1,
                limite: 50,
                total: 0,
                total_paginas: 0,
            });

            const empatadas = [randomUUID(), randomUUID()].sort();
            const superior = randomUUID();

            await database.withTransaction(async (client) => {
                // Insertamos deliberadamente en un orden distinto del esperado.
                for (const [id, idProyecto, orden] of [
                    [superior, proyecto, 5],
                    [empatadas[1], proyecto, 0],
                    [empatadas[0], proyecto, 0],
                    [randomUUID(), otroProyecto, 0],
                ]) {
                    await client.query(
                        `
              INSERT INTO obra.capas (
                id_capa, id_proyecto, id_usuario_subida,
                nombre, nombre_archivo_original, original_key,
                tamano_original_bytes, opacidad, visible, orden
              )
              VALUES (
                $1, $2, $3, 'Ortofoto', 'levantamiento.tif',
                $4, 1024, 0.65, FALSE, $5
              )
            `,
                        [
                            id,
                            idProyecto,
                            propietario,
                            `capas/${randomUUID()}.tif`,
                            orden,
                        ],
                    );
                }
            });

            const listado = await listar(cookiePropietario);

            assert.equal(listado.status, 200);
            assert.equal(listado.cache, 'no-store');
            assert.equal(listado.cuerpo.total, 3);
            assert.equal(listado.cuerpo.total_paginas, 1);

            assert.deepEqual(
                listado.cuerpo.capas.map((capa) => capa.id_capa),
                [...empatadas, superior],
            );

            for (const capa of listado.cuerpo.capas) {
                assert.equal(capa.id_proyecto, proyecto);
                assert.equal(capa.tamano_original_bytes, '1024');
                assert.equal(capa.opacidad, 0.65);
                assert.equal(capa.visible, false);
                assert.equal(capa.estado_procesamiento, 'PENDIENTE');
                assert.equal(capa.bbox, null);
                assert.equal(capa.teselas, null);
                assert.equal(Object.hasOwn(capa, 'mapbox_tileset_id'), false);

                for (const campo of [
                    'original_key',
                    'almacenamiento_proveedor',
                    'mapbox_source_id',
                    'mapbox_job_id',
                    'error_procesamiento',
                ]) {
                    assert.equal(Object.hasOwn(capa, campo), false);
                }
            }

            assert.deepEqual(
                (await listar(cookieColaborador)).cuerpo,
                listado.cuerpo,
            );

            const segunda = await listar(
                cookieColaborador,
                '?pagina=2&limite=2',
            );

            assert.equal(segunda.status, 200);
            assert.equal(segunda.cuerpo.pagina, 2);
            assert.equal(segunda.cuerpo.limite, 2);
            assert.equal(segunda.cuerpo.total, 3);
            assert.equal(segunda.cuerpo.total_paginas, 2);
            assert.deepEqual(
                segunda.cuerpo.capas.map((capa) => capa.id_capa),
                [superior],
            );

            assert.deepEqual(
                (await listar(cookieColaborador, '?pagina=3&limite=2')).cuerpo,
                {
                    capas: [],
                    pagina: 3,
                    limite: 2,
                    total: 3,
                    total_paginas: 2,
                },
            );

            for (const consulta of [
                '?pagina=0',
                '?pagina=1.5',
                '?pagina=2147483648',
                '?limite=0',
                '?limite=101',
                '?limite=',
                '?extra=1',
            ]) {
                assert.equal(
                    (await listar(cookieColaborador, consulta)).status,
                    400,
                );
            }

            const idCapa = empatadas[0];
            const configuracion = {
                opacidad: 0,
                visible: true,
                orden: 9,
            };

            async function configurar(
                cookie,
                cambios = configuracion,
                capa = idCapa,
                idProyecto = proyecto,
            ) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${idProyecto}/capas/${capa}/configuracion`,
                    {
                        method: 'PATCH',
                        headers: {
                            Origin: origen,
                            'Content-Type': 'application/json',
                            ...(cookie ? { Cookie: cookie } : {}),
                        },
                        body: JSON.stringify(cambios),
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            async function consultarCapa() {
                return (await database.query(
                    'SELECT * FROM obra.capas WHERE id_capa = $1',
                    [idCapa],
                )).rows[0];
            }

            const antes = await consultarCapa();

            assert.equal((await configurar()).status, 401);
            assert.equal((await configurar(cookieColaborador)).status, 404);
            assert.equal((await configurar(cookieAjeno)).status, 404);

            // El propietario de ambos proyectos no puede mezclar sus identificadores.
            assert.equal(
                (await configurar(
                    cookiePropietario,
                    configuracion,
                    idCapa,
                    otroProyecto,
                )).status,
                404,
            );

            assert.equal(
                (await configurar(cookiePropietario, configuracion, randomUUID())).status,
                404,
            );

            for (const cambios of [
                { ...configuracion, opacidad: '0.5' },
                { ...configuracion, opacidad: 1.1 },
                { ...configuracion, visible: 'false' },
                { ...configuracion, orden: -1 },
                { ...configuracion, orden: undefined },
                { ...configuracion, estado_procesamiento: 'LISTA' },
                { ...configuracion, original_key: 'otra-clave' },
            ]) {
                assert.equal(
                    (await configurar(cookiePropietario, cambios)).status,
                    400,
                );
            }

            assert.deepEqual(await consultarCapa(), antes);

            const historialAntes = await database.query(
                'SELECT id_actividad FROM obra.actividades WHERE id_proyecto = $1',
                [proyecto],
            );
            assert.equal(historialAntes.rowCount, 0);

            // Provocamos un fallo real de PostgreSQL después de actualizar la capa.
            // La transacción debe revertir tanto la configuración como su fecha.
            const actividades = app.get(ActividadesRepository);
            let configuracionDentroDeTransaccion;
            let errorHistorial;

            const falloHistorial = t.mock.method(
                actividades,
                'crear',
                async (client, datos) => {
                    assert.equal(datos.idProyecto, proyecto);
                    assert.equal(datos.idActor, propietario);
                    assert.equal(datos.tipoAccion, 'CAPA_CONFIGURACION_GUARDADA');

                    const resultado = await client.query(
                        `
                SELECT opacidad, visible, orden
                FROM obra.capas
                WHERE id_capa = $1
                  AND id_proyecto = $2
            `,
                        [idCapa, proyecto],
                    );

                    configuracionDentroDeTransaccion = resultado.rows[0];

                    try {
                        // mensaje es obligatorio: PostgreSQL debe rechazar este INSERT.
                        await client.query(
                            `
                    INSERT INTO obra.actividades (
                        id_proyecto,
                        id_actor,
                        tipo_accion,
                        mensaje
                    )
                    VALUES ($1, $2, $3, NULL)
                `,
                            [datos.idProyecto, datos.idActor, datos.tipoAccion],
                        );
                    } catch (error) {
                        errorHistorial = error;
                        throw error;
                    }
                },
            );

            try {
                const fallida = await configurar(cookiePropietario);

                assert.equal(fallida.status, 500);
                assert.equal(falloHistorial.mock.callCount(), 1);

                // Confirma que la actualización ocurrió antes del fallo del historial.
                assert.deepEqual(configuracionDentroDeTransaccion, {
                    opacidad: '0',
                    visible: configuracion.visible,
                    orden: configuracion.orden,
                });
                assert.equal(errorHistorial?.code, '23502');
            } finally {
                // Las comprobaciones siguientes vuelven a utilizar el repositorio real.
                falloHistorial.mock.restore();
            }

            // Incluye fecha_actualizacion: ningún cambio parcial debe persistir.
            assert.deepEqual(await consultarCapa(), antes);

            const historialTrasFallo = await database.query(
                'SELECT id_actividad FROM obra.actividades WHERE id_proyecto = $1',
                [proyecto],
            );
            assert.equal(historialTrasFallo.rowCount, 0);

            // Los colaboradores continúan viendo la configuración anterior.
            assert.deepEqual(
                (await listar(cookieColaborador)).cuerpo,
                listado.cuerpo,
            );

            const guardada = await configurar(cookiePropietario);

            assert.equal(guardada.status, 200);
            assert.equal(guardada.cache, 'no-store');

            const anteriorPublica = listado.cuerpo.capas.find(
                (capa) => capa.id_capa === idCapa,
            );

            assert.deepEqual(guardada.cuerpo, {
                ...anteriorPublica,
                ...configuracion,
                fecha_actualizacion: guardada.cuerpo.fecha_actualizacion,
            });
            assert.ok(Number.isFinite(Date.parse(guardada.cuerpo.fecha_actualizacion)));

            const despues = await consultarCapa();

            // Archivo, procesamiento, autor y extensión geográfica permanecen intactos.
            assert.deepEqual(despues, {
                ...antes,
                opacidad: '0',
                visible: true,
                orden: 9,
                fecha_actualizacion: despues.fecha_actualizacion,
            });
            assert.ok(
                despues.fecha_actualizacion.getTime()
                >= antes.fecha_actualizacion.getTime(),
            );
            assert.equal(
                despues.fecha_actualizacion.toISOString(),
                guardada.cuerpo.fecha_actualizacion,
            );

            // Construimos el nuevo resultado esperado: la capa pasa al final.
            listado.cuerpo.capas = [
                ...listado.cuerpo.capas.filter((capa) => capa.id_capa !== idCapa),
                guardada.cuerpo,
            ];

            // El colaborador ve la configuración compartida aunque no pueda modificarla.
            assert.deepEqual(
                (await listar(cookieColaborador)).cuerpo,
                listado.cuerpo,
            );

            const historial = await database.query(
                `
    SELECT id_actor, tipo_accion, mensaje
    FROM obra.actividades
    WHERE id_proyecto = $1
  `,
                [proyecto],
            );

            assert.deepEqual(historial.rows, [{
                id_actor: propietario,
                tipo_accion: 'CAPA_CONFIGURACION_GUARDADA',
                mensaje: `Configuración de la capa ${idCapa} guardada.`,
            }]);

            await database.query(
                'UPDATE obra.proyectos SET activo = FALSE WHERE id_proyecto = $1',
                [proyecto],
            );

            assert.equal((await listar(cookiePropietario)).status, 404);
            assert.equal((await listar(cookieColaborador)).status, 404);

            await database.query(
                'UPDATE obra.proyectos SET activo = TRUE WHERE id_proyecto = $1',
                [proyecto],
            );

            await database.query(
                `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
                [colaborador, proyecto],
            );

            assert.equal((await listar(cookieColaborador)).status, 404);
            assert.deepEqual(
                (await listar(cookiePropietario)).cuerpo,
                listado.cuerpo,
            );
        } finally {
            await database.withTransaction(async (client) => {
                await client.query(
                    'DELETE FROM obra.proyectos WHERE id_proyecto = ANY($1::uuid[])',
                    [[proyecto, otroProyecto]],
                );
                await client.query(
                    'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
                    [usuarios],
                );
            });
        }
    });
});