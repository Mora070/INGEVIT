require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

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

/**
 * Ejecuta la subida y descarga por HTTP con servicios reales.
 * La carpeta temporal y los registros pertenecen exclusivamente a la prueba.
 */
test('panorámicas HTTP: conserva el original y aplica el acceso del colaborador', async () => {
    await conAplicacionReal(async ({
        app, baseUrl, origen, raizTemporal,
    }) => {
        const database = app.get(DatabaseService);
        const passwords = app.get(PasswordService);

        const propietario = randomUUID();
        const colaborador = randomUUID();
        const proyecto = randomUUID();
        const usuarios = [propietario, colaborador];

        const password = 'Clave temporal de integración-2026';
        const hash = await passwords.generarHash(password);

        const original = await sharp({
            create: {
                width: 400,
                height: 200,
                channels: 3,
                background: { r: 30, g: 80, b: 120 },
            },
        }).png().toBuffer();

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
                        'Integración de panorámicas',
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

            async function subir(contenido, autenticado = true) {
                const form = new FormData();
                form.append('titulo', 'Sector norte');

                form.append('latitud', '4.711');
                form.append('longitud', '-74.0721');

                /*
                 * Declaramos JPEG aunque los bytes son PNG.
                 * El backend debe utilizar el formato detectado.
                 */
                form.append(
                    'archivo',
                    new Blob([contenido], { type: 'image/jpeg' }),
                    'nombre-enviado.jpg',
                );

                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/panoramicas`,
                    {
                        method: 'POST',
                        headers: {
                            Origin: origen,
                            ...(autenticado ? { Cookie: cookie } : {}),
                        },
                        body: form,
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            assert.equal((await subir(original, false)).status, 401);

            const subida = await subir(original);

            assert.equal(subida.status, 201);
            assert.equal(subida.cache, 'no-store');

            const panoramica = subida.cuerpo;

            assert.equal(panoramica.latitud, 4.711);
            assert.equal(panoramica.longitud, -74.0721);

            assert.equal(panoramica.id_proyecto, proyecto);
            assert.equal(panoramica.id_usuario_subida, colaborador);
            assert.equal(panoramica.titulo, 'Sector norte');
            assert.equal(panoramica.mime_type, 'image/png');
            assert.equal(Object.hasOwn(panoramica, 's3_key'), false);

            const registros = await database.query(
                'SELECT * FROM obra.panoramicas WHERE id_proyecto = $1',
                [proyecto],
            );

            assert.equal(registros.rows.length, 1);
            const registro = registros.rows[0];

            assert.equal(registro.id_panoramica, panoramica.id_panoramica);
            assert.equal(registro.id_usuario_subida, colaborador);
            assert.equal(registro.mime_type, 'image/png');
            assert.match(registro.s3_key, /^panoramicas\/[0-9a-f-]{36}\.png$/);
            // Comprobamos los valores persistidos, no solo los enviados por HTTP.
            assert.notEqual(registro.latitud, null);
            assert.notEqual(registro.longitud, null);
            assert.equal(Number(registro.latitud), 4.711);
            assert.equal(Number(registro.longitud), -74.0721);

            const nombreArchivo = registro.s3_key.slice('panoramicas/'.length);
            const carpeta = path.join(raizTemporal, 'panoramicas');

            assert.equal(
                panoramica.url,
                `/api/proyectos/${proyecto}/panoramicas/archivos/${nombreArchivo}`,
            );
            assert.equal(registro.url, panoramica.url);

            assert.deepEqual(
                await readFile(path.join(carpeta, nombreArchivo)),
                original,
            );

            const descarga = await fetch(`${baseUrl}${panoramica.url}`, {
                headers: { Cookie: cookie },
            });

            assert.equal(descarga.status, 200);
            assert.equal(descarga.headers.get('content-type'), 'image/png');
            assert.equal(descarga.headers.get('cache-control'), 'no-store');
            assert.equal(descarga.headers.get('content-disposition'), 'inline');
            assert.equal(
                descarga.headers.get('x-content-type-options'),
                'nosniff',
            );
            assert.deepEqual(
                Buffer.from(await descarga.arrayBuffer()),
                original,
            );

            const sinSesion = await fetch(`${baseUrl}${panoramica.url}`);
            await sinSesion.json();
            assert.equal(sinSesion.status, 401);

            assert.equal(
                (await subir(Buffer.from('Contenido ilegible'))).status,
                400,
            );

            async function listar(consulta = '') {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/panoramicas${consulta}`,
                    { headers: { Cookie: cookie } },
                );

                return {
                    status: respuesta.status,
                    cuerpo: await respuesta.json(),
                };
            }

            const listado = await listar();

            assert.equal(listado.status, 200);
            assert.deepEqual(listado.cuerpo, {
                panoramicas: [panoramica],
                pagina: 1,
                limite: 20,
                total: 1,
                total_paginas: 1,
            });

            const paginaVacia = await listar('?pagina=2&limite=1');

            assert.equal(paginaVacia.status, 200);
            assert.deepEqual(paginaVacia.cuerpo, {
                panoramicas: [],
                pagina: 2,
                limite: 1,
                total: 1,
                total_paginas: 1,
            });



            assert.equal((await listar('?limite=101')).status, 400);
            assert.equal((await listar('?pagina=0')).status, 400);
            assert.equal((await listar('?extra=1')).status, 400);

            async function editarTitulo(datos) {
                const respuesta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/panoramicas/${panoramica.id_panoramica}/titulo`,
                    {
                        method: 'PATCH',
                        headers: {
                            Origin: origen,
                            Cookie: cookie,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(datos),
                    },
                );

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            const edicion = await editarTitulo({
                titulo: 'Sector norte actualizado',
            });

            assert.equal(edicion.status, 200);
            assert.equal(edicion.cache, 'no-store');
            assert.deepEqual(edicion.cuerpo, {
                ...panoramica,
                titulo: 'Sector norte actualizado',
            });

            const registrosEditados = await database.query(
                `
          SELECT *
          FROM obra.panoramicas
          WHERE id_panoramica = $1
        `,
                [panoramica.id_panoramica],
            );

            // Compara todas las columnas: solo cambia el título.
            assert.deepEqual(registrosEditados.rows, [{
                ...registro,
                titulo: 'Sector norte actualizado',
            }]);

            assert.deepEqual(
                await readFile(path.join(carpeta, nombreArchivo)),
                original,
            );

            const listadoEditado = await listar();

            assert.equal(listadoEditado.status, 200);
            assert.deepEqual(
                listadoEditado.cuerpo.panoramicas,
                [edicion.cuerpo],
            );

            // La validación heredada también debe funcionar en esta ruta.
            assert.equal(
                (await editarTitulo({ titulo: '' })).status,
                400,
            );

            assert.equal(
                (await editarTitulo({
                    titulo: 'Cambio rechazado',
                    id_usuario_subida: propietario,
                })).status,
                400,
            );

            await database.query(
                `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
                [colaborador, proyecto],
            );

            const edicionSinAcceso = await editarTitulo({
                titulo: 'No debe guardarse',
            });

            assert.equal(edicionSinAcceso.status, 404);

            assert.equal((await listar()).status, 404);

            assert.equal((await subir(original)).status, 404);

            const sinAcceso = await fetch(`${baseUrl}${panoramica.url}`, {
                headers: { Cookie: cookie },
            });

            await sinAcceso.json();
            assert.equal(sinAcceso.status, 404);

            // Los rechazos no deben alterar el registro ni crear archivos.
            const posteriores = await database.query(
                'SELECT * FROM obra.panoramicas WHERE id_proyecto = $1',
                [proyecto],
            );

            assert.deepEqual(posteriores.rows, registrosEditados.rows);
            assert.deepEqual(await readdir(carpeta), [nombreArchivo]);

            const actividades = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
          ORDER BY tipo_accion
        `,
                [proyecto],
            );

            assert.deepEqual(actividades.rows, [
                {
                    id_actor: colaborador,
                    tipo_accion: 'PANORAMICA_SUBIDA',
                    mensaje: `Panorámica ${panoramica.id_panoramica} subida.`,
                },
                {
                    id_actor: colaborador,
                    tipo_accion: 'PANORAMICA_TITULO_GUARDADO',
                    mensaje:
                        `Título de la panorámica ${panoramica.id_panoramica} guardado.`,
                },
            ]);
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