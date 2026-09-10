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

test('crear proyecto: registra el proyecto y una actividad con la identidad autenticada', async () => {
  const database = new DatabaseService();
  const idPropietario = randomUUID();

  /**
   * Señal exclusiva de la prueba para revertir los datos
   * después de comprobar el resultado satisfactorio.
   */
  const rollbackDeLimpieza = new Error(
    'Reversión controlada de datos de prueba',
  );

  let idProyectoCreado;

  try {
    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
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
              `creacion-${idPropietario}@example.test`,
              `google-ficticio-${idPropietario}`,
            ],
          );

          /**
           * El servicio participa en la transacción exterior.
           * Este adaptador evita abrir una segunda transacción.
           *
           * Solo se utiliza en esta prueba para inspeccionar los
           * resultados antes de revertirlos.
           */
          const transaccionDePrueba = {
            withTransaction(operation) {
              return operation(client);
            },
          };

          const service = new ProyectosService(
            new ProyectosRepository(database),
            transaccionDePrueba,
            new ActividadesRepository(),
          );

          const resultado = await service.crear(
            idPropietario,
            {
              nombre: 'Proyecto de integración',
              descripcion: 'Descripción de integración',
              direccion: 'Dirección de integración',
              contratante: 'Cliente de integración',
              fecha_inicio: '2026-09-09',
              fecha_finalizacion: '2026-12-31',
              estado_proyecto: 'PAUSA',
              latitud: 0,
              longitud: -74.0721,
            },
          );

          idProyectoCreado = resultado.id_proyecto;

          assert.match(
            idProyectoCreado,
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );

          assert.deepEqual(resultado, {
            id_proyecto: idProyectoCreado,
            id_propietario: idPropietario,
            nombre: 'Proyecto de integración',
            descripcion: 'Descripción de integración',
            direccion: 'Dirección de integración',
            contratante: 'Cliente de integración',
            fecha_inicio: '2026-09-09',
            fecha_finalizacion: '2026-12-31',
            estado_proyecto: 'PAUSA',
            activo: true,
            latitud: 0,
            longitud: -74.0721,
          });

          // El proyecto debe existir en PostgreSQL.
          const proyecto = await client.query(
            `
              SELECT id_propietario, estado_proyecto, activo
              FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [idProyectoCreado],
          );

          assert.deepEqual(proyecto.rows, [
            {
              id_propietario: idPropietario,
              estado_proyecto: 'PAUSA',
              activo: true,
            },
          ]);

          // Debe existir exactamente una actividad de creación.
          const actividades = await client.query(
            `
              SELECT
                id_actividad,
                id_proyecto,
                id_actor,
                tipo_accion,
                mensaje,
                fecha_creacion
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
            `,
            [idProyectoCreado],
          );

          assert.equal(actividades.rows.length, 1);

          const actividad = actividades.rows[0];

          assert.match(
            actividad.id_actividad,
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          assert.equal(actividad.id_proyecto, idProyectoCreado);
          assert.equal(actividad.id_actor, idPropietario);
          assert.equal(actividad.tipo_accion, 'PROYECTO_CREADO');
          assert.equal(actividad.mensaje, 'Proyecto creado.');
          assert.ok(actividad.fecha_creacion instanceof Date);
          assert.ok(
            Number.isFinite(actividad.fecha_creacion.getTime()),
          );

          // El propietario no debe añadirse como colaborador.
          const colaboradores = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuario_proyecto
              WHERE id_proyecto = $1::uuid
            `,
            [idProyectoCreado],
          );

          assert.deepEqual(colaboradores.rows, []);

          // Todas las comprobaciones terminaron: revertimos la preparación.
          throw rollbackDeLimpieza;
        }),
      (error) => {
        /**
         * Solo aceptamos nuestra señal de limpieza.
         * Un error SQL o una aserción fallida deben hacer fallar la prueba.
         */
        assert.strictEqual(error, rollbackDeLimpieza);
        return true;
      },
    );

    // Confirma que la reversión no dejó el proyecto temporal.
    const proyectoFinal = await database.query(
      `
        SELECT id_proyecto
        FROM obra.proyectos
        WHERE id_proyecto = $1::uuid
      `,
      [idProyectoCreado],
    );

    assert.deepEqual(proyectoFinal.rows, []);
  } finally {
    await database.onApplicationShutdown();
  }
});