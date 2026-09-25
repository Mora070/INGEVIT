require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  RecuperacionCodigoRepository,
} = require('../../dist/modules/auth/recuperacion-codigo.repository');

const {
  generarCodigoRecuperacion,
  getRecuperacionSecret,
  protegerCodigoRecuperacion,
} = require('../../dist/modules/auth/utils/codigo-recuperacion');

/*
 * SISTEMA ANTERIOR:
 *
 * const {
 *   generarTokenRecuperacion,
 * } = require('../../dist/modules/auth/utils/token-recuperacion');
 *
 * Ya no se utiliza porque la recuperación actual funciona mediante
 * códigos de ocho dígitos protegidos mediante HMAC.
 */

/**
 * Ejecuta SQL real y revierte todos los datos al finalizar.
 *
 * Los hashes de contraseña son ficticios: aquí comprobamos persistencia.
 * PasswordService tiene sus propias pruebas de Argon2.
 */
test(
  'recuperación: reemplaza, consume una sola vez y rechaza solicitudes no válidas',
  async () => {
    const database = new DatabaseService();
    const repository = new RecuperacionCodigoRepository();
    const secreto = getRecuperacionSecret();

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
                id_usuario,
                correo,
                password_hash,
                google_sub,
                estado
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

          /*
           * El repositorio actual limita las emisiones de una misma cuenta
           * a una por cada 60 segundos.
           *
           * Este test no pretende probar ese límite. Para poder probar
           * varios escenarios de recuperación sobre la misma cuenta,
           * eliminamos el registro del límite antes de una nueva emisión.
           *
           * La siguiente llamada a repository.emitir() crea nuevamente
           * el registro mediante la lógica real de producción.
           */
          async function prepararNuevaEmision() {
            await client.query(
              `
                DELETE FROM obra.recuperacion_limites
                WHERE id_usuario = $1
              `,
              [local],
            );
          }

          async function emitir(correo = correoLocal) {
            if (correo === correoLocal) {
              await prepararNuevaEmision();
            }

            const codigo = generarCodigoRecuperacion();

            const destinatario = await repository.emitir(
              client,
              correo,
              codigo,
              secreto,
            );

            return {
              codigo,
              destinatario,
            };
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

          /*
           * Intenta consumir un código que debe ser rechazado.
           *
           * API actual:
           *
           * consumir(
           *   client,
           *   correo,
           *   codigo,
           *   nuevoPasswordHash,
           *   secreto,
           * )
           */
          async function rechazar(correo, codigo) {
            const antes = await cuenta();

            const resultado = await repository.consumir(
              client,
              correo,
              codigo,
              'hash-rechazado',
              secreto,
            );

            assert.equal(resultado, false);

            assert.deepEqual(
              await cuenta(),
              antes,
            );
          }

          // ------------------------------------------------------------
          // CUENTAS QUE NO PUEDEN SOLICITAR RECUPERACIÓN
          // ------------------------------------------------------------

          for (const correo of [
            `${randomUUID()}@example.invalid`,
            `${google}@example.invalid`,
            `${inactivo}@example.invalid`,
          ]) {
            assert.equal(
              (await emitir(correo)).destinatario,
              null,
            );
          }

          const sinSolicitudes = await client.query(
            `
              SELECT id_usuario
              FROM obra.recuperaciones_password
              WHERE id_usuario = ANY($1::uuid[])
            `,
            [[local, google, inactivo]],
          );

          assert.equal(
            sinSolicitudes.rowCount,
            0,
          );

          // ------------------------------------------------------------
          // EMISIÓN NORMAL
          // ------------------------------------------------------------

          // El correo se busca sin distinguir mayúsculas.
          const primera = await emitir(
            correoLocal.toUpperCase(),
          );

          assert.equal(
            primera.destinatario,
            correoLocal,
          );

          // El código debe tener exactamente ocho dígitos.
          assert.match(
            primera.codigo,
            /^[0-9]{8}$/,
          );

          const solicitud = await client.query(
            `
              SELECT
                token_hash,
                version_sesion,
                EXTRACT(
                  EPOCH FROM (
                    fecha_expiracion - fecha_creacion
                  )
                )::integer AS duracion
              FROM obra.recuperaciones_password
              WHERE id_usuario = $1
            `,
            [local],
          );

          assert.equal(
            solicitud.rowCount,
            1,
          );

          /*
           * El código no se almacena directamente.
           * Se almacena el HMAC calculado a partir del usuario,
           * código y secreto.
           */
          assert.equal(
            solicitud.rows[0].token_hash,
            protegerCodigoRecuperacion(
              local,
              primera.codigo,
              secreto,
            ),
          );

          assert.equal(
            solicitud.rows[0].version_sesion,
            0,
          );

          assert.equal(
            solicitud.rows[0].duracion,
            900,
          );

          // ------------------------------------------------------------
          // UNA NUEVA EMISIÓN INVALIDA LA ANTERIOR
          // ------------------------------------------------------------

          const segunda = await emitir();

          assert.notEqual(
            segunda.destinatario,
            null,
          );

          assert.notEqual(
            segunda.codigo,
            primera.codigo,
          );

          // El código anterior ya no debe funcionar.
          await rechazar(
            correoLocal,
            primera.codigo,
          );

          // El código nuevo sí debe funcionar.
          assert.equal(
            await repository.consumir(
              client,
              correoLocal,
              segunda.codigo,
              'hash-restablecido',
              secreto,
            ),
            true,
          );

          assert.deepEqual(
            await cuenta(),
            {
              password_hash: 'hash-restablecido',
              version_sesion: 1,
            },
          );

          // ------------------------------------------------------------
          // EL MISMO CÓDIGO NO PUEDE UTILIZARSE DOS VECES
          // ------------------------------------------------------------

          await rechazar(
            correoLocal,
            segunda.codigo,
          );

          const consumida = await client.query(
            `
              SELECT id_usuario
              FROM obra.recuperaciones_password
              WHERE id_usuario = $1
            `,
            [local],
          );

          assert.equal(
            consumida.rowCount,
            0,
          );

          // ------------------------------------------------------------
          // VENCIMIENTO
          // ------------------------------------------------------------

          const vencida = await emitir();

          assert.notEqual(
            vencida.destinatario,
            null,
          );

          await client.query(
            `
              UPDATE obra.recuperaciones_password
              SET
                fecha_creacion =
                  clock_timestamp() - interval '20 minutes',
                fecha_expiracion =
                  clock_timestamp() - interval '5 minutes'
              WHERE id_usuario = $1
            `,
            [local],
          );

          await rechazar(
            correoLocal,
            vencida.codigo,
          );

          // ------------------------------------------------------------
          // CAMBIO DE VERSION_SESION
          // ------------------------------------------------------------

          const desactualizada = await emitir();

          assert.notEqual(
            desactualizada.destinatario,
            null,
          );

          await client.query(
            `
              UPDATE obra.usuarios
              SET version_sesion = version_sesion + 1
              WHERE id_usuario = $1
            `,
            [local],
          );

          await rechazar(
            correoLocal,
            desactualizada.codigo,
          );

          // ------------------------------------------------------------
          // CUENTA INACTIVA
          // ------------------------------------------------------------

          const antesDeInactivar = await emitir();

          assert.notEqual(
            antesDeInactivar.destinatario,
            null,
          );

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'INACTIVO'
              WHERE id_usuario = $1
            `,
            [local],
          );

          await rechazar(
            correoLocal,
            antesDeInactivar.codigo,
          );

          await client.query(
            `
              UPDATE obra.usuarios
              SET estado = 'ACTIVO'
              WHERE id_usuario = $1
            `,
            [local],
          );

          // ------------------------------------------------------------
          // CUENTA CONVERTIDA EN GOOGLE
          // ------------------------------------------------------------

          const antesDeGoogle = await emitir();

          assert.notEqual(
            antesDeGoogle.destinatario,
            null,
          );

          await client.query(
            `
              UPDATE obra.usuarios
              SET
                google_sub = $2,
                password_hash = NULL
              WHERE id_usuario = $1
            `,
            [
              local,
              `convertida-${local}`,
            ],
          );

          await rechazar(
            correoLocal,
            antesDeGoogle.codigo,
          );

          assert.equal(
            (await cuenta()).password_hash,
            null,
          );

          /*
           * Fuerza el rollback para que los datos de la prueba
           * no permanezcan en PostgreSQL.
           */
          throw finalizar;
        }),
        (error) => error === finalizar,
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);