require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID } = require('node:crypto');

const {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
} = require('node:fs/promises');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  AlmacenamientoLocalService,
} = require(
  '../../dist/modules/almacenamiento/almacenamiento-local.service',
);

const {
  FotografiasArchivosService,
} = require(
  '../../dist/modules/fotografias/fotografias-archivos.service',
);

const {
  FotografiasPersistenciaService,
} = require(
  '../../dist/modules/fotografias/fotografias-persistencia.service',
);

const {
  FotografiasRepository,
} = require(
  '../../dist/modules/fotografias/fotografias.repository',
);

const {
  ActividadesRepository,
} = require(
  '../../dist/modules/actividades/actividades.repository',
);

test(
  'persistencia de fotografías: revierte los metadatos y elimina ambas versiones si falla la actividad',
  async () => {
    const configuracionAnterior = process.env.STORAGE_LOCAL_ROOT;
    const temporal = await mkdtemp(
      path.join(tmpdir(), 'ingevit-persistencia-rollback-'),
    );

    let database;

    try {
      const raiz = path.join(temporal, 'storage');
      await mkdir(raiz);

      process.env.STORAGE_LOCAL_ROOT = raiz;

      const almacenamiento = new AlmacenamientoLocalService();
      await almacenamiento.onModuleInit();

      database = new DatabaseService();

      const archivos = new FotografiasArchivosService(almacenamiento);
      const persistencia = new FotografiasPersistenciaService(
        database,
        archivos,
      );

      const fotografiasRepository = new FotografiasRepository();
      const actividadesRepository = new ActividadesRepository();

      const idUsuario = randomUUID();
      const idProyecto = randomUUID();
      const idActorInexistente = randomUUID();

      /*
       * Esta prueba evalúa persistencia y compensación, no procesamiento.
       * Los buffers representan las versiones previamente procesadas.
       */
      const procesada = {
        original: Buffer.from('Bytes originales de prueba.'),
        formatoOriginal: 'jpeg',
        optimizada: Buffer.from('Bytes optimizados de prueba.'),
      };

      let idFotografia;
      let registroInsertado = false;

      await assert.rejects(
        persistencia.guardarYRegistrar(
          procesada,
          async (client, claves) => {
            // Ambas escrituras deben haberse completado antes del registro.
            assert.deepEqual(
              await readFile(
                path.join(raiz, ...claves.original_s3_key.split('/')),
              ),
              procesada.original,
            );

            assert.deepEqual(
              await readFile(
                path.join(raiz, ...claves.s3_key.split('/')),
              ),
              procesada.optimizada,
            );

            /*
             * Los datos de preparación se crean dentro de la misma
             * transacción para que también desaparezcan con el rollback.
             */
            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario, correo, google_sub, rol, estado
                )
                VALUES (
                  $1::uuid,
                  $2,
                  $3,
                  'USUARIO'::obra.rol_usuario,
                  'ACTIVO'::obra.estado_usuario
                )
              `,
              [
                idUsuario,
                `integracion-${idUsuario}@example.invalid`,
                `google-integracion-${idUsuario}`,
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
                VALUES (
                  $1::uuid,
                  $2::uuid,
                  'Proyecto temporal de compensación',
                  'Preparación de prueba',
                  'Dirección temporal',
                  'Contratante temporal',
                  '2026-09-11'::date,
                  'ACTIVA'::obra.estado_proyecto
                )
              `,
              [idProyecto, idUsuario],
            );

            const fotografia = await fotografiasRepository.crear(
              client,
              {
                idProyecto,
                idUsuarioSubida: idUsuario,
                titulo: 'Fotografía temporal',
                url: 'https://example.invalid/optimizada.webp',
                s3Key: claves.s3_key,
                originalS3Key: claves.original_s3_key,
              },
            );

            idFotografia = fotografia.id_fotografia;
            registroInsertado = true;

            // Provoca un fallo real de integridad después de la inserción.
            await actividadesRepository.crear(client, {
              idProyecto,
              idActor: idActorInexistente,
              tipoAccion: 'FOTOGRAFIA_SUBIDA',
              mensaje: 'Fotografía subida.',
            });

            return fotografia;
          },
        ),
        (error) => {
          assert.equal(error.code, '23503');
          assert.equal(
            error.constraint,
            'actividades_id_actor_fkey',
          );

          return true;
        },
      );

      assert.equal(registroInsertado, true);

      /*
       * Estas consultas ocurren después de que la transacción terminó.
       * Comprueban el estado real dejado por DatabaseService.
       */
      const fotografiaPosterior = await database.query(
        `
          SELECT id_fotografia
          FROM obra.fotografias
          WHERE id_fotografia = $1::uuid
        `,
        [idFotografia],
      );

      assert.equal(fotografiaPosterior.rowCount, 0);

      const proyectoPosterior = await database.query(
        `
          SELECT id_proyecto
          FROM obra.proyectos
          WHERE id_proyecto = $1::uuid
        `,
        [idProyecto],
      );

      assert.equal(proyectoPosterior.rowCount, 0);

      const usuarioPosterior = await database.query(
        `
          SELECT id_usuario
          FROM obra.usuarios
          WHERE id_usuario = $1::uuid
        `,
        [idUsuario],
      );

      assert.equal(usuarioPosterior.rowCount, 0);

      // La compensación debe haber retirado las dos versiones.
      assert.deepEqual(
        await readdir(path.join(raiz, 'fotografias')),
        [],
      );
    } finally {
      if (configuracionAnterior === undefined) {
        delete process.env.STORAGE_LOCAL_ROOT;
      } else {
        process.env.STORAGE_LOCAL_ROOT = configuracionAnterior;
      }

      try {
        if (database) {
          await database.onApplicationShutdown();
        }
      } finally {
        await rm(temporal, {
          recursive: true,
          force: true,
        });
      }
    }
  },
);