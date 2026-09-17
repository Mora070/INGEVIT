require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');

const {
    DatabaseService,
} = require('../../dist/database/database.service');

const {
    RecuperacionCodigoRepository,
} = require('../../dist/modules/auth/recuperacion-codigo.repository');

/**
 * Comprueba intentos concurrentes contra PostgreSQL real.
 *
 * Cada intento confirma su propia transacción, como hace el servicio.
 * No envía correos ni modifica cuentas existentes.
 */
test('recuperación código: conserva cinco fallos concurrentes, bloquea el código y permite sustituirlo', async () => {
    const database = new DatabaseService();
    const repository = new RecuperacionCodigoRepository();

    const id = randomUUID();
    const correo = `${id}@example.invalid`;
    const secreto = randomBytes(32);
    const codigo = '00123456';
    const incorrecto = '99887766';
    const nuevoCodigo = '00765432';

    await database.onModuleInit();

    async function consumir(valor) {
        return database.withTransaction((client) =>
            repository.consumir(
                client,
                correo,
                valor,
                'hash-nuevo-de-prueba',
                secreto,
            ),
        );
    }

    async function consultarCuenta() {
        const resultado = await database.query(
            `
        SELECT password_hash, version_sesion
        FROM obra.usuarios
        WHERE id_usuario = $1
      `,
            [id],
        );

        return resultado.rows[0];
    }

    try {
        await database.query(
            `
        INSERT INTO obra.usuarios (
          id_usuario, correo, password_hash
        )
        VALUES ($1, $2, 'hash-inicial-de-prueba')
      `,
            [id, correo],
        );

        await database.withTransaction(async (client) => {
            assert.equal(
                await repository.emitir(client, correo, codigo, secreto),
                correo,
            );
        });

        /*
         * Iniciamos los cinco intentos sin esperar entre ellos.
         * allSettled espera todos antes de comprobar o limpiar datos,
         * incluso si alguna operación produce un error inesperado.
         */
        const resultados = await Promise.allSettled(
            Array.from({ length: 5 }, () => consumir(incorrecto)),
        );

        for (const resultado of resultados) {
            assert.equal(
                resultado.status,
                'fulfilled',
                resultado.status === 'rejected'
                    ? String(resultado.reason)
                    : undefined,
            );
            assert.equal(resultado.value, false);
        }

        const bloqueada = await database.query(
            `
        SELECT intentos_fallidos
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
      `,
            [id],
        );

        assert.equal(bloqueada.rows[0].intentos_fallidos, 5);

        // El sexto intento falla incluso con el código correcto.
        assert.equal(await consumir(codigo), false);
        assert.equal(await consumir(incorrecto), false);

        const despuesDelLimite = await database.query(
            `
        SELECT intentos_fallidos
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
      `,
            [id],
        );

        assert.equal(despuesDelLimite.rows[0].intentos_fallidos, 5);
        assert.deepEqual(await consultarCuenta(), {
            password_hash: 'hash-inicial-de-prueba',
            version_sesion: 0,
        });

        // Simula que transcurrió el intervalo mínimo sin esperar un minuto.
        await database.query(
            `
    UPDATE obra.recuperacion_limites
    SET inicio_ventana = clock_timestamp() - interval '2 minutes',
        ultima_emision = clock_timestamp() - interval '61 seconds'
    WHERE id_usuario = $1
  `,
            [id],
        );

        // Una nueva emisión sustituye el código y reinicia sus intentos.
        await database.withTransaction((client) =>
            repository.emitir(client, correo, nuevoCodigo, secreto),
        );

        const renovada = await database.query(
            `
        SELECT intentos_fallidos
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
      `,
            [id],
        );

        assert.equal(renovada.rows[0].intentos_fallidos, 0);

        // El código anterior ya no funciona y cuenta como intento fallido.
        assert.equal(await consumir(codigo), false);

        const despuesDelAnterior = await database.query(
            `
        SELECT intentos_fallidos
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
      `,
            [id],
        );

        assert.equal(despuesDelAnterior.rows[0].intentos_fallidos, 1);

        // Conserva los ceros iniciales y consume el código vigente.
        assert.equal(await consumir(nuevoCodigo), true);

        assert.deepEqual(await consultarCuenta(), {
            password_hash: 'hash-nuevo-de-prueba',
            version_sesion: 1,
        });

        // Uso único.
        assert.equal(await consumir(nuevoCodigo), false);

        const consumida = await database.query(
            `
        SELECT id_usuario
        FROM obra.recuperaciones_password
        WHERE id_usuario = $1
      `,
            [id],
        );

        assert.equal(consumida.rowCount, 0);
    } finally {
        try {
            // ON DELETE CASCADE retira cualquier solicitud restante.
            await database.query(
                'DELETE FROM obra.usuarios WHERE id_usuario = $1',
                [id],
            );
        } finally {
            await database.onApplicationShutdown();
        }
    }
});