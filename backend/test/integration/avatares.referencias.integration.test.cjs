require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

/**
 * Comprueba las referencias de avatares contra PostgreSQL real.
 *
 * Utiliza datos propios dentro de una transacción que se revierte.
 * No crea archivos ni ejecuta el trabajador de limpieza.
 */
test('avatares: protege cuentas activas e inactivas y libera la referencia al retirar la foto', async () => {
  const database = new DatabaseService();
  const repository = new ArchivosPendientesRepository();

  const idUsuario = randomUUID();
  const clave = `avatares/${randomUUID()}.webp`;
  const claveAjena = `avatares/${randomUUID()}.webp`;
  const finPrueba = new Error('Reversión deliberada de la prueba');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario,
              correo,
              google_sub,
              estado,
              foto_perfil_url,
              foto_perfil_key
            )
            VALUES ($1, $2, $3, 'ACTIVO', $4, $5)
          `,
          [
            idUsuario,
            `${idUsuario}@example.invalid`,
            `avatar-integracion-${idUsuario}`,
            `/avatar-prueba/${idUsuario}.webp`,
            clave,
          ],
        );

        // La cuenta activa conserva su archivo.
        assert.equal(
          await repository.estaReferenciadoEnAvatares(client, clave),
          true,
        );

        // Una clave diferente no debe confundirse con el avatar existente.
        assert.equal(
          await repository.estaReferenciadoEnAvatares(client, claveAjena),
          false,
        );

        await client.query(
          `
            UPDATE obra.usuarios
            SET estado = 'INACTIVO'
            WHERE id_usuario = $1
          `,
          [idUsuario],
        );

        // La inactividad no autoriza la eliminación de su fotografía.
        assert.equal(
          await repository.estaReferenciadoEnAvatares(client, clave),
          true,
        );

        // URL y clave se retiran juntas para mantener la integridad.
        await client.query(
          `
            UPDATE obra.usuarios
            SET foto_perfil_url = NULL,
                foto_perfil_key = NULL
            WHERE id_usuario = $1
          `,
          [idUsuario],
        );

        assert.equal(
          await repository.estaReferenciadoEnAvatares(client, clave),
          false,
        );

        throw finPrueba;
      }),
      // Solo aceptamos nuestra reversión deliberada.
      // Cualquier error de SQL o de una comprobación hace fallar la prueba.
      (error) => error === finPrueba,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});