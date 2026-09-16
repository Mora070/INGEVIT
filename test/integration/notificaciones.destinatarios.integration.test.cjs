require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
    DatabaseService,
} = require('../../dist/database/database.service');



/**
 * Verifica la selección con PostgreSQL real.
 * Todos los datos se crean y comprueban dentro de una transacción
 * que se revierte deliberadamente al finalizar.
 */
test('notificaciones: selecciona destinatarios activos, excluye al creador y evita duplicados', async () => {
    const database = new DatabaseService();


    const propietario = randomUUID();
    const creador = randomUUID();
    const colaborador = randomUUID();
    const inactivo = randomUUID();
    const ajeno = randomUUID();

    const proyecto = randomUUID();
    const plano = randomUUID();
    const finPrueba = new Error('Reversión deliberada de los datos de prueba');

    await database.onModuleInit();

    try {
        await assert.rejects(
            database.withTransaction(async (client) => {
                for (const id of [
                    propietario, creador, colaborador, inactivo, ajeno,
                ]) {
                    await client.query(
                        `
              INSERT INTO obra.usuarios (
                id_usuario, correo, google_sub, estado
              )
              VALUES ($1, $2, $3, $4)
            `,
                        [
                            id,
                            `${id}@example.invalid`,
                            `integracion-${id}`,
                            id === inactivo ? 'INACTIVO' : 'ACTIVO',
                        ],
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
                        'Destinatarios de notificaciones',
                        'Dirección temporal',
                        'Contratante temporal',
                        '2026-09-16',
                        'ACTIVA',
                    ],
                );

                /*
                 * Incluimos al propietario como colaborador para comprobar
                 * que no reciba dos notificaciones.
                 * El usuario ajeno no pertenece al proyecto.
                 */
                for (const id of [propietario, creador, colaborador, inactivo]) {
                    await client.query(
                        `
              INSERT INTO obra.usuario_proyecto (
                id_usuario, id_proyecto
              )
              VALUES ($1, $2)
            `,
                        [id, proyecto],
                    );
                }

                await client.query(
                    `
            INSERT INTO obra.planos (
              id_plano, id_proyecto, id_usuario_subida,
              titulo, descripcion, url, s3_key, numero_paginas
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
          `,
                    [
                        plano,
                        proyecto,
                        propietario,
                        'Plano temporal',
                        '',
                        '/plano-temporal.pdf',
                        `planos/${randomUUID()}.pdf`,
                    ],
                );

                async function crearIncidencia(actor) {
                    const id = randomUUID();

                    await client.query(
                        `
              INSERT INTO obra.incidencias (
                id_incidencia, id_plano, id_proyecto, id_creador,
                titulo, descripcion, estado, prioridad,
                numero_pagina, coordenada_x, coordenada_y
              )
              VALUES (
                $1, $2, $3, $4, $5, $6,
                'PENDIENTE', 'MEDIA', 1, 0.5, 0.5
              )
            `,
                        [
                            id,
                            plano,
                            proyecto,
                            actor,
                            'Incidencia temporal',
                            'Prueba de destinatarios',
                        ],
                    );

                    return id;
                }

                async function comprobar(actor, esperados) {
                    /*
                     * El INSERT de la incidencia activa el trigger.
                     * No realizamos una segunda inserción de notificaciones.
                     */
                    const incidencia = await crearIncidencia(actor);

                    const resultado = await client.query(
                        `
              SELECT
                id_receptor, id_actor, id_proyecto, id_incidencia,
                tipo, titulo, mensaje, estado_envio_correo
              FROM obra.notificaciones
              WHERE id_incidencia = $1
              ORDER BY id_receptor
            `,
                        [incidencia],
                    );

                    assert.equal(resultado.rows.length, esperados.length);

                    assert.deepEqual(
                        resultado.rows,
                        [...esperados].sort().map((receptor) => ({
                            id_receptor: receptor,
                            id_actor: actor,
                            id_proyecto: proyecto,
                            id_incidencia: incidencia,
                            tipo: 'INCIDENCIA_CREADA',
                            titulo: 'Incidencia creada',
                            mensaje: 'Incidencia temporal',
                            estado_envio_correo: 'PENDIENTE',
                        })),
                    );
                }

                // Colaborador creador: reciben propietario y otro colaborador activo.
                await comprobar(creador, [propietario, colaborador]);

                // Propietario creador: recibe cada colaborador activo, sin notificarse.
                await comprobar(propietario, [creador, colaborador]);

                // Sin otros miembros activos, cero destinatarios es válido.
                await client.query(
                    `
            DELETE FROM obra.usuario_proyecto
            WHERE id_proyecto = $1
              AND id_usuario = ANY($2::uuid[])
          `,
                    [proyecto, [creador, colaborador]],
                );

                await comprobar(propietario, []);

                // Revierte usuarios, proyecto, plano, incidencias y notificaciones.
                throw finPrueba;
            }),
            (error) => error === finPrueba,
        );
    } finally {
        await database.onApplicationShutdown();
    }
});