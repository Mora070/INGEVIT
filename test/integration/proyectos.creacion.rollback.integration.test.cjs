require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  ProyectosRepository,
} = require('../../dist/modules/proyectos/proyectos.repository');

const {
  ProyectosService,
} = require('../../dist/modules/proyectos/proyectos.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

test('crear proyecto: revierte el proyecto cuando PostgreSQL rechaza su actividad', async () => {
  const database = new DatabaseService();

  const idPropietario = randomUUID();
  const idActorInexistente = randomUUID();

  let idProyectoInsertado;

  try {
    // Confirma que el actor utilizado para provocar el fallo no existe.
    const actor = await database.query(
      `
        SELECT id_usuario
        FROM obra.usuarios
        WHERE id_usuario = $1::uuid
      `,
      [idActorInexistente],
    );

    assert.equal(actor.rows.length, 0);

    /**
     * Conserva el comportamiento real del repositorio.
     * Solo captura el identificador para comprobar posteriormente
     * que el proyecto insertado fue revertido.
     */
    class ProyectosRepositoryObservado extends ProyectosRepository {
      async crear(client, datos) {
        const proyecto = await super.crear(client, datos);
        idProyectoInsertado = proyecto.id_proyecto;
        return proyecto;
      }
    }

    const proyectosRepository =
      new ProyectosRepositoryObservado(database);

    const actividadesRepository = new ActividadesRepository();

    /**
     * Adaptador exclusivo de la prueba.
     *
     * Inserta el propietario temporal dentro de la misma transacción
     * real, antes de ejecutar la operación del servicio.
     * Así el ROLLBACK también elimina los datos de preparación.
     */
    const databaseConPreparacion = {
      withTransaction(operation) {
        return database.withTransaction(async (client) => {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario,
                correo,
                google_sub,
                rol,
                estado
              )
              VALUES (
                $1::uuid,
                $2,
                $3,
                'USUARIO',
                'ACTIVO'
              )
            `,
            [
              idPropietario,
              `rollback-${idPropietario}@example.test`,
              `google-ficticio-${idPropietario}`,
            ],
          );

          return operation(client);
        });
      },
    };

    /**
     * Inyección deliberada de un fallo.
     *
     * La inserción del historial sigue siendo SQL real.
     * Cambiamos únicamente el actor para provocar la infracción
     * de la FK actividades_id_actor_fkey.
     *
     * Este adaptador no forma parte del código de producción.
     */
    const actividadesConFallo = {
      async crear(client, datos) {
        assert.equal(datos.idActor, idPropietario);
        assert.equal(datos.idProyecto, idProyectoInsertado);

        // Confirma que el proyecto existe dentro de la transacción
        // antes de ejecutar la inserción que fallará.
        const proyectoVisible = await client.query(
          `
            SELECT id_proyecto
            FROM obra.proyectos
            WHERE id_proyecto = $1::uuid
          `,
          [datos.idProyecto],
        );

        assert.equal(proyectoVisible.rows.length, 1);

        return actividadesRepository.crear(client, {
          ...datos,
          idActor: idActorInexistente,
        });
      },
    };

    const service = new ProyectosService(
      proyectosRepository,
      databaseConPreparacion,
      actividadesConFallo,
    );

    await assert.rejects(
      () =>
        service.crear(idPropietario, {
          nombre: 'Proyecto temporal para comprobar rollback',
          descripcion: 'Prueba de atomicidad',
          direccion: 'Dirección de prueba',
          contratante: 'Cliente de prueba',
          fecha_inicio: '2026-09-09',
          estado_proyecto: 'ACTIVA',
        }),
      (error) => {
        // PostgreSQL: foreign_key_violation.
        assert.equal(error.code, '23503');
        assert.equal(
          error.constraint,
          'actividades_id_actor_fkey',
        );
        return true;
      },
    );

    assert.equal(typeof idProyectoInsertado, 'string');

    /**
     * Estas consultas ocurren después de finalizar withTransaction().
     * Comprueban el estado real de PostgreSQL tras el ROLLBACK.
     */
    const proyectoFinal = await database.query(
      `
        SELECT id_proyecto
        FROM obra.proyectos
        WHERE id_proyecto = $1::uuid
      `,
      [idProyectoInsertado],
    );

    const actividadesFinales = await database.query(
      `
        SELECT id_actividad
        FROM obra.actividades
        WHERE id_proyecto = $1::uuid
      `,
      [idProyectoInsertado],
    );

    const propietarioFinal = await database.query(
      `
        SELECT id_usuario
        FROM obra.usuarios
        WHERE id_usuario = $1::uuid
      `,
      [idPropietario],
    );

    assert.equal(proyectoFinal.rows.length, 0);
    assert.equal(actividadesFinales.rows.length, 0);
    assert.equal(propietarioFinal.rows.length, 0);
  } finally {
    await database.onApplicationShutdown();
  }
});