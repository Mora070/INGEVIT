require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  RecuperacionPasswordRepository,
} = require('../../dist/modules/auth/recuperacion-password.repository');

const {
  generarTokenRecuperacion,
} = require('../../dist/modules/auth/utils/token-recuperacion');

/**
 * Ejecuta SQL real y revierte todos los datos al finalizar.
 *
 * Los hashes de contraseña son ficticios: aquí comprobamos persistencia.
 * PasswordService tiene sus propias pruebas de Argon2.
 */
test('recuperación: reemplaza, consume una sola vez y rechaza solicitudes no válidas', async () => {
  const database = new DatabaseService();
  const repository = new RecuperacionPasswordRepository();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const local = randomUUID();
        const google = randomUUID();
        const inactivo = randomUUID();
        const correoLocal = `${local}@example.invalid`;

        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, password_hash, google_sub, estado
            )
            VALUES
              ($1, $2, 'hash-inicial', NULL, 'ACTIVO'),
              ($3, $4, NULL, $5, 'ACTIVO'),
              ($6, $7, 'hash-inactivo', NULL, 'INACTIVO')
          `,
          [
            local,
            correoLocal,
            google,
            `${google}@example.invalid`,
            `google-${google}`,
            inactivo,
            `${inactivo}@example.invalid`,
          ],
        );

        async function emitir(correo = correoLocal) {
          const { tokenHash } = generarTokenRecuperacion();
          const destinatario = await repository.emitir(
            client,
            correo,
            tokenHash,
          );
          return { tokenHash, destinatario };
        }

        async function cuenta() {
          const resultado = await client.query(
            `
              SELECT password_hash, version_sesion
              FROM obra.usuarios
              WHERE id_usuario = $1
            `,
            [local],
          );
          return resultado.rows[0];
        }

        async function rechazar(tokenHash) {
          const antes = await cuenta();

          assert.equal(
            await repository.consumir(client, tokenHash, 'hash-rechazado'),
            false,
          );

          assert.deepEqual(await cuenta(), antes);
        }

        // No se emiten solicitudes para cuentas no habilitadas.
        for (const correo of [
          `${randomUUID()}@example.invalid`,
          `${google}@example.invalid`,
          `${inactivo}@example.invalid`,
        ]) {
          assert.equal((await emitir(correo)).destinatario, null);
        }

        const sinSolicitudes = await client.query(
          `
            SELECT id_usuario
            FROM obra.recuperaciones_password
            WHERE id_usuario = ANY($1::uuid[])
          `,
          [[local, google, inactivo]],
        );
        assert.equal(sinSolicitudes.rowCount, 0);

        // El correo se busca sin distinguir mayúsculas.
        const primera = await emitir(correoLocal.toUpperCase());
        assert.equal(primera.destinatario, correoLocal);

        const solicitud = await client.query(
          `
            SELECT token_hash, version_sesion,
                   EXTRACT(EPOCH FROM (
                     fecha_expiracion - fecha_creacion
                   ))::integer AS duracion
            FROM obra.recuperaciones_password
            WHERE id_usuario = $1
          `,
          [local],
        );

        assert.deepEqual(solicitud.rows, [{
          token_hash: primera.tokenHash,
          version_sesion: 0,
          duracion: 900,
        }]);

        // Una nueva emisión invalida la anterior.
        const segunda = await emitir();
        await rechazar(primera.tokenHash);

        assert.equal(
          await repository.consumir(
            client,
            segunda.tokenHash,
            'hash-restablecido',
          ),
          true,
        );

        assert.deepEqual(await cuenta(), {
          password_hash: 'hash-restablecido',
          version_sesion: 1,
        });

        // El mismo token no puede volver a utilizarse.
        await rechazar(segunda.tokenHash);

        const consumida = await client.query(
          `
            SELECT id_usuario
            FROM obra.recuperaciones_password
            WHERE id_usuario = $1
          `,
          [local],
        );
        assert.equal(consumida.rowCount, 0);

        // Vencimiento: ajustamos ambas fechas respetando la restricción.
        const vencida = await emitir();

        await client.query(
          `
            UPDATE obra.recuperaciones_password
            SET fecha_creacion = clock_timestamp() - interval '20 minutes',
                fecha_expiracion = clock_timestamp() - interval '5 minutes'
            WHERE id_usuario = $1
          `,
          [local],
        );

        await rechazar(vencida.tokenHash);

        // Un cambio de versión de sesión invalida el enlace emitido.
        const desactualizada = await emitir();

        await client.query(
          `
            UPDATE obra.usuarios
            SET version_sesion = version_sesion + 1
            WHERE id_usuario = $1
          `,
          [local],
        );

        await rechazar(desactualizada.tokenHash);

        // Inactivar la cuenta después de emitir también impide consumir.
        const antesDeInactivar = await emitir();

        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [local],
        );

        await rechazar(antesDeInactivar.tokenHash);

        await client.query(
          "UPDATE obra.usuarios SET estado = 'ACTIVO' WHERE id_usuario = $1",
          [local],
        );

        // Si pasa a ser una cuenta exclusiva de Google, no asigna contraseña.
        const antesDeGoogle = await emitir();

        await client.query(
          `
            UPDATE obra.usuarios
            SET google_sub = $2, password_hash = NULL
            WHERE id_usuario = $1
          `,
          [local, `convertida-${local}`],
        );

        await rechazar(antesDeGoogle.tokenHash);
        assert.equal((await cuenta()).password_hash, null);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});