require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
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

/**
 * Recorre el flujo real:
 * login -> multipart -> validación -> almacenamiento -> PostgreSQL.
 *
 * Utiliza usuarios y un proyecto exclusivos de la prueba.
 * El ayudante proporciona una carpeta temporal y la elimina al terminar.
 */
test('planos subida HTTP: conserva el original, registra la actividad y rechaza archivos inválidos', async () => {
    await conAplicacionReal(async ({
        app,
        baseUrl,
        origen,
        raizTemporal,
    }) => {
        const database = app.get(DatabaseService);
        const passwords = app.get(PasswordService);

        const propietario = randomUUID();
        const colaborador = randomUUID();
        const proyecto = randomUUID();
        const usuarios = [propietario, colaborador];

        const password = 'Clave temporal de integración-2026';
        const hash = await passwords.generarHash(password);

        const documento = await PDFDocument.create();
        documento.addPage([300, 400]);
        documento.addPage([400, 300]);
        const original = Buffer.from(await documento.save());

        const carpetaPlanos = path.join(raizTemporal, 'planos');
        const ruta = `${baseUrl}/api/proyectos/${proyecto}/planos`;

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
                        'Integración de subida de planos',
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

            // Autenticamos al colaborador para comprobar su permiso de subida.
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
                form.append('titulo', 'Plano estructural');
                form.append('descripcion', 'Dos páginas de prueba');
                form.append(
                    'archivo',
                    new Blob([contenido], { type: 'application/pdf' }),
                    'estructura.pdf',
                );

                const respuesta = await fetch(ruta, {
                    method: 'POST',
                    headers: {
                        Origin: origen,
                        ...(autenticado ? { Cookie: cookie } : {}),
                    },
                    body: form,
                });

                return {
                    status: respuesta.status,
                    cache: respuesta.headers.get('cache-control'),
                    cuerpo: await respuesta.json(),
                };
            }

            const sinSesion = await subir(original, false);
            assert.equal(sinSesion.status, 401);

            const subida = await subir(original);
            assert.equal(subida.status, 201);
            assert.equal(subida.cache, 'no-store');

            const plano = subida.cuerpo;

            assert.equal(plano.id_proyecto, proyecto);
            assert.equal(plano.id_usuario_subida, colaborador);
            assert.equal(plano.titulo, 'Plano estructural');
            assert.equal(plano.descripcion, 'Dos páginas de prueba');
            assert.equal(plano.mime_type, 'application/pdf');
            assert.equal(Object.hasOwn(plano, 's3_key'), false);

            const registros = await database.query(
                `
          SELECT *
          FROM obra.planos
          WHERE id_proyecto = $1
        `,
                [proyecto],
            );

            assert.equal(registros.rows.length, 1);
            const registro = registros.rows[0];

            assert.equal(registro.id_plano, plano.id_plano);
            assert.equal(registro.id_usuario_subida, colaborador);
            assert.equal(registro.url, plano.url);

            // Validamos el formato antes de convertir la clave en ruta local.
            assert.match(
                registro.s3_key,
                /^planos\/[0-9a-f-]{36}\.pdf$/,
            );

            const nombreArchivo = registro.s3_key.slice('planos/'.length);

            assert.equal(
                plano.url,
                `/api/proyectos/${proyecto}/planos/archivos/${nombreArchivo}`,
            );

            const bytesGuardados = await readFile(
                path.join(carpetaPlanos, nombreArchivo),
            );

            // La comparación completa detecta cualquier modificación del PDF.
            assert.deepEqual(bytesGuardados, original);
            // La URL publicada entrega exactamente el PDF original.
            const descarga = await fetch(`${baseUrl}${plano.url}`, {
                headers: { Cookie: cookie },
            });

            assert.equal(descarga.status, 200);
            assert.equal(
                descarga.headers.get('content-type'),
                'application/pdf',
            );
            assert.equal(
                descarga.headers.get('content-disposition'),
                'inline; filename="plano.pdf"',
            );
            assert.equal(
                descarga.headers.get('cache-control'),
                'no-store',
            );
            assert.equal(
                descarga.headers.get('x-content-type-options'),
                'nosniff',
            );

            assert.deepEqual(
                Buffer.from(await descarga.arrayBuffer()),
                original,
            );

            const descargaSinSesion = await fetch(
                `${baseUrl}${plano.url}`,
            );

            await descargaSinSesion.json();
            assert.equal(descargaSinSesion.status, 401);
            assert.deepEqual(await readdir(carpetaPlanos), [nombreArchivo]);

            const actividades = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
        `,
                [proyecto],
            );

            assert.deepEqual(actividades.rows, [{
                id_actor: colaborador,
                tipo_accion: 'PLANO_SUBIDO',
                mensaje: `Plano ${plano.id_plano} subido.`,
            }]);

            // El listado debe publicar el mismo plano que acabamos de subir.
            const listado = await fetch(ruta, {
                headers: { Cookie: cookie },
            });

            assert.equal(listado.status, 200);
            const pagina = await listado.json();

            assert.equal(pagina.total, 1);
            assert.deepEqual(pagina.planos, [plano]);

            // El colaborador puede editar los datos descriptivos del plano.
            const edicion = await fetch(`${ruta}/${plano.id_plano}`, {
                method: 'PATCH',
                headers: {
                    Origin: origen,
                    Cookie: cookie,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    titulo: 'Plano estructural revisado',
                    descripcion: '',
                }),
            });

            assert.equal(edicion.status, 200);
            assert.equal(edicion.headers.get('cache-control'), 'no-store');

            const planoEditado = await edicion.json();

            // Únicamente deben cambiar los dos campos descriptivos.
            assert.deepEqual(planoEditado, {
                ...plano,
                titulo: 'Plano estructural revisado',
                descripcion: '',
            });

            const registroEditado = await database.query(
                `
          SELECT *
          FROM obra.planos
          WHERE id_plano = $1 AND id_proyecto = $2
        `,
                [plano.id_plano, proyecto],
            );

            assert.equal(registroEditado.rows.length, 1);

            // Compara todas las columnas, incluidas autor, clave y fecha.
            assert.deepEqual(registroEditado.rows[0], {
                ...registro,
                titulo: 'Plano estructural revisado',
                descripcion: '',
            });

            assert.deepEqual(
                await readFile(path.join(carpetaPlanos, nombreArchivo)),
                original,
            );

            // La URL original sigue entregando exactamente el mismo PDF.
            const descargaTrasEditar = await fetch(
                `${baseUrl}${plano.url}`,
                { headers: { Cookie: cookie } },
            );

            assert.equal(descargaTrasEditar.status, 200);
            assert.deepEqual(
                Buffer.from(await descargaTrasEditar.arrayBuffer()),
                original,
            );

            const actividadEdicion = await database.query(
                `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
            AND tipo_accion = 'PLANO_DATOS_GUARDADOS'
        `,
                [proyecto],
            );

            assert.deepEqual(actividadEdicion.rows, [{
                id_actor: colaborador,
                tipo_accion: 'PLANO_DATOS_GUARDADOS',
                mensaje: `Datos del plano ${plano.id_plano} guardados.`,
            }]);

            // Declarar application/pdf no convierte un texto en un PDF.
            const invalido = await subir(Buffer.from('Esto no es un PDF'));
            assert.equal(invalido.status, 400);

            // Al retirar al colaborador, su siguiente subida debe rechazarse.
            await database.query(
                `
          DELETE FROM obra.usuario_proyecto
          WHERE id_usuario = $1 AND id_proyecto = $2
        `,
                [colaborador, proyecto],
            );

            const accesoRetirado = await subir(original);
            assert.equal(accesoRetirado.status, 404);

            const edicionSinAcceso = await fetch(
                `${ruta}/${plano.id_plano}`,
                {
                    method: 'PATCH',
                    headers: {
                        Origin: origen,
                        Cookie: cookie,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        titulo: 'Cambio que debe rechazarse',
                        descripcion: 'Sin permiso',
                    }),
                },
            );

            await edicionSinAcceso.json();
            assert.equal(edicionSinAcceso.status, 404);

            const datosConservados = await database.query(
                `
          SELECT titulo, descripcion
          FROM obra.planos
          WHERE id_plano = $1 AND id_proyecto = $2
        `,
                [plano.id_plano, proyecto],
            );

            assert.deepEqual(datosConservados.rows, [{
                titulo: 'Plano estructural revisado',
                descripcion: '',
            }]);

            // La cookie continúa vigente, pero la pertenencia ya fue retirada.
            const descargaSinAcceso = await fetch(
                `${baseUrl}${plano.url}`,
                { headers: { Cookie: cookie } },
            );

            await descargaSinAcceso.json();
            assert.equal(descargaSinAcceso.status, 404);

            // Los rechazos anteriores no deben dejar efectos adicionales.
            const conteos = await database.query(
                `
          SELECT
            (
              SELECT COUNT(*)::text
              FROM obra.planos
              WHERE id_proyecto = $1
            ) AS planos,
            (
              SELECT COUNT(*)::text
              FROM obra.actividades
              WHERE id_proyecto = $1
            ) AS actividades
        `,
                [proyecto],
            );

            assert.deepEqual(conteos.rows, [{
                planos: '1',
                actividades: '2',
            }]);

            assert.deepEqual(await readdir(carpetaPlanos), [nombreArchivo]);
        } finally {
            /*
             * Eliminamos únicamente los datos identificados por esta prueba.
             * El proyecto elimina sus planos y actividades por cascada.
             * La carpeta temporal se limpia mediante conAplicacionReal.
             */
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