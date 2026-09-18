require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasDescargaRepository,
} = require('../../dist/modules/fotografias/fotografias-descarga.repository');

/**
 * Comprueba la autorización ejecutando el SQL real del repositorio.
 *
 * Todos los datos y cambios quedan dentro de una transacción
 * que se revierte al finalizar, incluso si falla una comprobación.
 */
test(
  'descarga de fotografías: aplica permisos y distingue original y optimizada',
  async () => {
    const database = new DatabaseService();
    const finalizarPrueba = new Error('Revertir datos de integración');

    const idPropietario = randomUUID();
    const idColaborador = randomUUID();
    const idAjeno = randomUUID();
    const idProyecto = randomUUID();

    const claveOptimizada = `fotografias/${randomUUID()}.webp`;
    const claveOriginal = `fotografias/${randomUUID()}.jpeg`;

    try {
      await database.onModuleInit();

      await assert.rejects(
        () =>
          database.withTransaction(async (client) => {
            /*
             * El adaptador mantiene todas las consultas del repositorio
             * en la misma conexión y transacción de preparación.
             */
            const repositorio = new FotografiasDescargaRepository({
              query: (sql, valores) => client.query(sql, valores),
            });

            for (const idUsuario of [
              idPropietario,
              idColaborador,
              idAjeno,
            ]) {
              await client.query(
                `
                  INSERT INTO obra.usuarios (
                    id_usuario,
                    correo,
                    google_sub
                  )
                  VALUES ($1, $2, $3)
                `,
                [
                  idUsuario,
                  `${idUsuario}@example.invalid`,
                  `integracion-${idUsuario}`,
                ],
              );
            }

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
                idPropietario,
                'Proyecto temporal',
                'Prueba de permisos de descarga',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-11',
                'ACTIVA',
              ],
            );

            await client.query(
              `
                INSERT INTO obra.usuario_proyecto (
                  id_usuario,
                  id_proyecto
                )
                VALUES ($1, $2)
              `,
              [idColaborador, idProyecto],
            );

            await client.query(
              `
                INSERT INTO obra.fotografias (
                  id_proyecto,
                  id_usuario_subida,
                  titulo,
                  url,
                  s3_key,
                  original_s3_key
                )
                VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [
                idProyecto,
                idColaborador,
                'Fotografía temporal',
                '/fotografia-temporal.webp',
                claveOptimizada,
                claveOriginal,
              ],
            );

            const consultar = (
              idUsuario,
              clave = claveOptimizada,
              proyecto = idProyecto,
            ) =>
              repositorio.buscarOptimizadaDisponible(
                proyecto,
                idUsuario,
                clave,
              );

            // Propietario y colaborador pueden consultar la optimizada.
            assert.deepEqual(
              await consultar(idPropietario),
              { s3_key: claveOptimizada },
            );

            assert.deepEqual(
              await consultar(idColaborador),
              { s3_key: claveOptimizada },
            );

            // La clave del respaldo no sirve para esta operación.
            assert.equal(
              await consultar(idPropietario, claveOriginal),
              null,
            );

            assert.equal(
              await consultar(
                idPropietario,
                `fotografias/${randomUUID()}.webp`,
              ),
              null,
            );

            // Una clave existente debe coincidir con el proyecto indicado.
            assert.equal(
              await consultar(
                idPropietario,
                claveOptimizada,
                randomUUID(),
              ),
              null,
            );

            assert.equal(await consultar(idAjeno), null);
            assert.equal(await consultar(randomUUID()), null);

            // El rol global no concede acceso a proyectos ajenos.
            await client.query(
              `
                UPDATE obra.usuarios
                SET rol = 'ADMINISTRADOR'
                WHERE id_usuario = $1
              `,
              [idAjeno],
            );

            assert.equal(await consultar(idAjeno), null);

            // Un colaborador inactivo pierde el acceso.
            await client.query(
              `
                UPDATE obra.usuarios
                SET estado = 'INACTIVO'
                WHERE id_usuario = $1
              `,
              [idColaborador],
            );

            assert.equal(await consultar(idColaborador), null);

            await client.query(
              `
                UPDATE obra.usuarios
                SET estado = 'ACTIVO'
                WHERE id_usuario = $1
              `,
              [idColaborador],
            );

            // La inactivación del propietario bloquea el proyecto.
            await client.query(
              `
                UPDATE obra.usuarios
                SET estado = 'INACTIVO'
                WHERE id_usuario = $1
              `,
              [idPropietario],
            );

            assert.equal(await consultar(idPropietario), null);
            assert.equal(await consultar(idColaborador), null);

            await client.query(
              `
                UPDATE obra.usuarios
                SET estado = 'ACTIVO'
                WHERE id_usuario = $1
              `,
              [idPropietario],
            );

            // La eliminación lógica también impide descargar.
            await client.query(
              `
                UPDATE obra.proyectos
                SET activo = FALSE
                WHERE id_proyecto = $1
              `,
              [idProyecto],
            );

            assert.equal(await consultar(idPropietario), null);
            assert.equal(await consultar(idColaborador), null);

            await client.query(
              `
                UPDATE obra.proyectos
                SET activo = TRUE
                WHERE id_proyecto = $1
              `,
              [idProyecto],
            );

            // Retirar al colaborador conserva la foto, pero retira su acceso.
            await client.query(
              `
                DELETE FROM obra.usuario_proyecto
                WHERE id_usuario = $1
                  AND id_proyecto = $2
              `,
              [idColaborador, idProyecto],
            );

            assert.equal(await consultar(idColaborador), null);

            assert.deepEqual(
              await consultar(idPropietario),
              { s3_key: claveOptimizada },
            );

            /*
             * Fuerza el ROLLBACK después de las comprobaciones.
             * Un fallo de aserción también provoca la reversión,
             * pero no será confundido con este resultado esperado.
             */
            throw finalizarPrueba;
          }),
        (error) => {
          assert.strictEqual(error, finalizarPrueba);
          return true;
        },
      );
    } finally {
      await database.onApplicationShutdown();
    }
  },
);