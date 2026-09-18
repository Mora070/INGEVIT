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

const {
  FotografiasRepository,
} = require('../../dist/modules/fotografias/fotografias.repository');

test(
  'referencias: protege original y optimizada hasta eliminar la fotografía',
  async () => {
    const database = new DatabaseService();
    const pendientes = new ArchivosPendientesRepository();
    const fotografias = new FotografiasRepository();

    const finalizar = new Error('Revertir datos de integración');
    let conexionInicializada = false;

    try {
      await database.onModuleInit();
      conexionInicializada = true;

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            const idUsuario = randomUUID();
            const idProyecto = randomUUID();

            const claveOriginal = `fotografias/${randomUUID()}.jpeg`;
            const claveOptimizada = `fotografias/${randomUUID()}.webp`;
            const claveSinReferencia = `fotografias/${randomUUID()}.webp`;

            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, google_sub
                )
                VALUES ($1, $2, $3)
              `,
              [
                idUsuario,
                `${idUsuario}@example.invalid`,
                `integracion-${idUsuario}`,
              ],
            );

            await client.query(
              `
                INSERT INTO obra.proyectos (
                  id_proyecto,
                  id_propietario,
                  nombre,
                  descripcion,
                  direccion,
                  contratante,
                  fecha_inicio,
                  estado_proyecto
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `,
              [
                idProyecto,
                idUsuario,
                'Proyecto temporal',
                'Prueba de referencias de archivos',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-14',
                'ACTIVA',
              ],
            );

            const fotografia = await fotografias.crear(client, {
              idProyecto,
              idUsuarioSubida: idUsuario,
              titulo: 'Fotografía temporal',
              url: '/fotografia-temporal.webp',
              originalS3Key: claveOriginal,
              s3Key: claveOptimizada,
            });

            const comprobarReferencias = async (esperado) => {
              for (const clave of [claveOriginal, claveOptimizada]) {
                assert.equal(
                  await pendientes.estaReferenciadoEnFotografias(
                    client,
                    clave,
                  ),
                  esperado,
                );
              }
            };

            // Ambas versiones pertenecen a una fotografía existente.
            await comprobarReferencias(true);

            assert.equal(
              await pendientes.estaReferenciadoEnFotografias(
                client,
                claveSinReferencia,
              ),
              false,
            );

            // Un proyecto inactivo sigue conservando sus archivos.
            await client.query(
              `
                UPDATE obra.proyectos
                SET activo = FALSE
                WHERE id_proyecto = $1
              `,
              [idProyecto],
            );

            await comprobarReferencias(true);

            // La inactivación del propietario tampoco libera referencias.
            await client.query(
              `
                UPDATE obra.usuarios
                SET estado = 'INACTIVO'
                WHERE id_usuario = $1
              `,
              [idUsuario],
            );

            await comprobarReferencias(true);

            /*
             * Eliminamos directamente mediante el repositorio para
             * comprobar las referencias, no los permisos de negocio.
             * Esta operación permanece dentro de la prueba revertida.
             */
            const eliminada = await fotografias.eliminar(
              client,
              idProyecto,
              fotografia.id_fotografia,
            );

            assert.ok(eliminada);

            // Sin el registro, ninguna de las dos claves está referenciada.
            await comprobarReferencias(false);

            throw finalizar;
          }),
        (error) => {
          assert.strictEqual(error, finalizar);
          return true;
        },
      );
    } finally {
      if (conexionInicializada) {
        await database.onApplicationShutdown();
      }
    }
  },
);