require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  FotografiasAccesoRepository,
} = require(
  '../../dist/modules/fotografias/fotografias-acceso.repository',
);

/**
 * Señal para coordinar operaciones sin depender de pausas arbitrarias.
 */
function crearSenal() {
  let resolver;

  const promesa = new Promise((resolve) => {
    resolver = resolve;
  });

  return { promesa, resolver };
}

/**
 * Espera hasta observar el bloqueo real en PostgreSQL.
 *
 * El plazo evita que una regresión deje esperando indefinidamente
 * la comprobación. No fuerza ni cancela consultas de otras sesiones.
 */
async function esperarBloqueo(database, pidSolicitante, pidRetirada) {
  const vencimiento = Date.now() + 5000;

  while (Date.now() < vencimiento) {
    const resultado = await database.query(
      `
        SELECT $2::integer = ANY(
          pg_blocking_pids($1::integer)
        ) AS bloqueado
      `,
      [pidSolicitante, pidRetirada],
    );

    if (resultado.rows[0].bloqueado) {
      return;
    }

    await esperar(25);
  }

  assert.fail(
    'No se observó que la consulta de acceso esperara a la retirada.',
  );
}

test(
  'fotografías: rechaza al colaborador retirado mientras esperaba el bloqueo del proyecto',
  async () => {
    const database = new DatabaseService();
    const repositorio = new FotografiasAccesoRepository();

    const idPropietario = randomUUID();
    const idColaborador = randomUUID();
    const idProyecto = randomUUID();

    const retiradaPreparada = crearSenal();
    const permitirConfirmacion = crearSenal();
    const solicitantePreparado = crearSenal();

    let retirada;
    let acceso;

    try {
      // Confirmamos únicamente los registros exclusivos de esta prueba.
      await database.withTransaction(async (client) => {
        for (const id of [idPropietario, idColaborador]) {
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
              id,
              `integracion-${id}@example.invalid`,
              `google-integracion-${id}`,
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
            VALUES (
              $1::uuid,
              $2::uuid,
              'Proyecto temporal de concurrencia',
              'Preparación de prueba',
              'Dirección temporal',
              'Contratante temporal',
              '2026-09-11'::date,
              'ACTIVA'::obra.estado_proyecto
            )
          `,
          [idProyecto, idPropietario],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario, id_proyecto
            )
            VALUES ($1::uuid, $2::uuid)
          `,
          [idColaborador, idProyecto],
        );
      });

      retirada = database.withTransaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '10s'");

        const sesion = await client.query(
          'SELECT pg_backend_pid() AS pid',
        );

        // Reproduce el bloqueo utilizado al gestionar colaboradores.
        await client.query(
          `
            SELECT id_proyecto
            FROM obra.proyectos
            WHERE id_proyecto = $1::uuid
            FOR UPDATE
          `,
          [idProyecto],
        );

        await client.query(
          `
            DELETE FROM obra.usuario_proyecto
            WHERE id_usuario = $1::uuid
              AND id_proyecto = $2::uuid
          `,
          [idColaborador, idProyecto],
        );

        retiradaPreparada.resolver(sesion.rows[0].pid);

        // La eliminación permanece sin confirmar hasta que observemos
        // a la otra transacción esperando el bloqueo.
        await permitirConfirmacion.promesa;
      });

      // Evita rechazos sin manejar mientras coordinamos las dos promesas.
      retirada.catch(() => {});

      const pidRetirada = await Promise.race([
        retiradaPreparada.promesa,
        retirada.then(() => {
          throw new Error('La retirada terminó antes de la coordinación.');
        }),
      ]);

      acceso = database.withTransaction(async (client) => {
        await client.query("SET LOCAL lock_timeout = '10s'");

        const sesion = await client.query(
          'SELECT pg_backend_pid() AS pid',
        );

        solicitantePreparado.resolver(sesion.rows[0].pid);

        return repositorio.bloquearDisponible(
          client,
          idProyecto,
          idColaborador,
        );
      });

      acceso.catch(() => {});

      const pidSolicitante = await Promise.race([
        solicitantePreparado.promesa,
        acceso.then(() => {
          throw new Error('El acceso terminó antes de la coordinación.');
        }),
      ]);

      assert.notEqual(pidSolicitante, pidRetirada);

      await esperarBloqueo(
        database,
        pidSolicitante,
        pidRetirada,
      );

      permitirConfirmacion.resolver();

      await retirada;

      // La consulta de colaboración debe ver la retirada ya confirmada.
      assert.equal(await acceso, false);
    } finally {
      // Liberamos la espera incluso si falla una comprobación.
      permitirConfirmacion.resolver();

      await Promise.allSettled(
        [retirada, acceso].filter(Boolean),
      );

      try {
        // Limpieza limitada a los UUID generados por esta prueba.
        await database.withTransaction(async (client) => {
          await client.query(
            'DELETE FROM obra.proyectos WHERE id_proyecto = $1::uuid',
            [idProyecto],
          );

          await client.query(
            `
              DELETE FROM obra.usuarios
              WHERE id_usuario IN ($1::uuid, $2::uuid)
            `,
            [idPropietario, idColaborador],
          );
        });
      } finally {
        await database.onApplicationShutdown();
      }
    }
  },
);