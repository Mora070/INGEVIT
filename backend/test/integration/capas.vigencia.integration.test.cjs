require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DatabaseService } = require('../../dist/database/database.service');
const { CapasProcesamientoRepository } = require('../../dist/modules/capas/capas-procesamiento.repository');
const { CapasReintentoRepository } = require('../../dist/modules/capas/capas-reintento.repository');

/** Usa varias conexiones reales y modifica exclusivamente su proyecto temporal. */
test('vigencia real: renueva, recupera sin competir y bloquea tokens vencidos o antiguos', async () => {
    const database = new DatabaseService();
    const repo = new CapasProcesamientoRepository();
    const reintento = new CapasReintentoRepository();
    const usuario = randomUUID(), proyecto = randomUUID();
    const activa = randomUUID(), interrumpida = randomUUID();
    const publicacion = {
        version: randomUUID(), proveedor: 'LOCAL',
        zoomMin: 12, zoomMax: 22, tamano: 256, total: '1',
    };
    await database.onModuleInit();
    try {
        await database.withTransaction(async client => {
            await client.query(
                'INSERT INTO obra.usuarios (id_usuario, correo, google_sub) VALUES ($1, $2, $3)',
                [usuario, `${usuario}@example.invalid`, `vigencia-${usuario}`],
            );
            await client.query(
                `INSERT INTO obra.proyectos
                 (id_proyecto, id_propietario, nombre, descripcion, direccion, contratante, fecha_inicio, estado_proyecto)
                 VALUES ($1, $2, 'Vigencia', 'Integración', 'Temporal', 'Temporal', '2026-09-24', 'ACTIVA')`,
                [proyecto, usuario],
            );
            for (const capa of [activa, interrumpida]) {
                await client.query(
                    `INSERT INTO obra.capas
                     (id_capa, id_proyecto, id_usuario_subida, nombre, nombre_archivo_original,
                      original_key, tamano_original_bytes, crs_original, bbox_oeste, bbox_sur, bbox_este, bbox_norte)
                     VALUES ($1, $2, $3, 'Prueba', 'original.tif', $4, 1024, 'EPSG:4326', -74.2, 4.6, -74.1, 4.7)`,
                    [capa, proyecto, usuario, `capas/${randomUUID()}.tif`],
                );
            }
        });
        const iniciar = capa => database.withTransaction(c => repo.iniciar(c, proyecto, capa));
        const renovar = (capa, token) => database.withTransaction(c => repo.renovar(c, proyecto, capa, token));
        const recuperar = () => database.withTransaction(c => repo.recuperarVencidos(c, 20, proyecto));
        const consultar = async capa => (await database.query('SELECT * FROM obra.capas WHERE id_capa = $1', [capa])).rows[0];

        const enCurso = await iniciar(activa);
        const abandonada = await iniciar(interrumpida);
        assert.ok(enCurso.procesamiento_vence instanceof Date);
        assert.ok(enCurso.procesamiento_vence > enCurso.procesamiento_inicio);
        assert.equal(await renovar(activa, randomUUID()), false);
        assert.equal(await renovar(activa, enCurso.procesamiento_token), true);
        assert.deepEqual(await recuperar(), []);

        // Simula exclusivamente el vencimiento de nuestro fixture, sin esperar minutos.
        await database.query(
            "UPDATE obra.capas SET procesamiento_vence = clock_timestamp() - INTERVAL '1 second' WHERE id_capa = $1",
            [interrumpida],
        );
        assert.equal(await renovar(interrumpida, abandonada.procesamiento_token), false);
        assert.equal(await database.withTransaction(c => repo.finalizar(
            c, proyecto, interrumpida, abandonada.procesamiento_token, publicacion,
        )), null);

        // Una fila que ya tiene un bloqueo no se recupera desde otra conexión.
        await database.withTransaction(async client => {
            await client.query('SELECT id_capa FROM obra.capas WHERE id_capa = $1 FOR UPDATE', [interrumpida]);
            assert.deepEqual(await recuperar(), []);
        });

        // Dos recuperadores concurrentes cierran el permiso una sola vez.
        const resultados = await Promise.all([recuperar(), recuperar()]);
        assert.deepEqual(resultados.flat(), [interrumpida]);
        const cerrada = await consultar(interrumpida);
        assert.equal(cerrada.estado_procesamiento, 'ERROR');
        assert.equal(cerrada.procesamiento_token, null);
        assert.equal(cerrada.procesamiento_inicio, null);
        assert.equal(cerrada.procesamiento_vence, null);
        assert.equal(cerrada.original_key, abandonada.original_key);
        assert.equal((await consultar(activa)).estado_procesamiento, 'PROCESANDO');

        await database.withTransaction(async client => {
            await reintento.bloquear(client, proyecto, interrumpida);
            assert.equal(await reintento.encolar(client, proyecto, interrumpida), true);
        });
        const nuevo = await iniciar(interrumpida);
        assert.notEqual(nuevo.procesamiento_token, abandonada.procesamiento_token);
        assert.equal(await renovar(interrumpida, abandonada.procesamiento_token), false);
        assert.equal(await database.withTransaction(c => repo.marcarError(
            c, proyecto, interrumpida, abandonada.procesamiento_token,
        )), null);
        assert.equal(await database.withTransaction(c => repo.finalizar(
            c, proyecto, interrumpida, abandonada.procesamiento_token, publicacion,
        )), null);

        const lista = await database.withTransaction(c => repo.finalizar(
            c, proyecto, interrumpida, nuevo.procesamiento_token, publicacion,
        ));
        assert.equal(lista.estado_procesamiento, 'LISTA');
        assert.equal(lista.procesamiento_vence, null);
        assert.equal(lista.teselas_version, publicacion.version);
        assert.deepEqual(await recuperar(), []);
        assert.deepEqual(await consultar(interrumpida), lista);
    } finally {
        try {
            await database.withTransaction(async client => {
                await client.query('DELETE FROM obra.proyectos WHERE id_proyecto = $1', [proyecto]);
                await client.query('DELETE FROM obra.usuarios WHERE id_usuario = $1', [usuario]);
            });
        } finally {
            await database.onApplicationShutdown();
        }
    }
});
