require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NotFoundException } = require('@nestjs/common');

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

test('actualizar proyecto: exige propiedad y conserva el historial y los colaboradores', async () => {
  const database = new DatabaseService();
  const rollbackDeLimpieza = new Error('Reversión controlada');

  try {
    await assert.rejects(
      () =>
        database.withTransaction(async (client) => {
          /**
           * Crea cuentas temporales sin contactar con Google.
           * La identidad ficticia satisface la restricción de autenticación.
           */
          async function crearUsuario(rol = 'USUARIO') {
            const idUsuario = randomUUID();

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
                  $4::obra.rol_usuario,
                  'ACTIVO'
                )
              `,
              [
                idUsuario,
                `edicion-${idUsuario}@example.test`,
                `google-ficticio-${idUsuario}`,
                rol,
              ],
            );

            return idUsuario;
          }

          const propietario = await crearUsuario();
          const colaborador = await crearUsuario();
          const administrador = await crearUsuario('ADMINISTRADOR');

          /**
           * Hace participar al servicio en la transacción exterior.
           * No abre transacciones anidadas ni confirma datos.
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

          const creado = await service.crear(propietario, {
            nombre: 'Proyecto original',
            descripcion: 'Descripción original',
            direccion: 'Dirección original',
            contratante: 'Cliente original',
            fecha_inicio: '2026-09-01',
            fecha_finalizacion: '2026-12-31',
            estado_proyecto: 'ACTIVA',
            latitud: 4.711,
            longitud: -74.0721,
          });

          await client.query(
            `
              INSERT INTO obra.usuario_proyecto (
                id_usuario,
                id_proyecto
              )
              VALUES ($1::uuid, $2::uuid)
            `,
            [colaborador, creado.id_proyecto],
          );

          const datosActualizados = {
            nombre: 'Proyecto actualizado',
            descripcion: 'Descripción actualizada',
            direccion: 'Dirección actualizada',
            contratante: 'Cliente actualizado',
            fecha_inicio: '2026-09-09',
            estado_proyecto: 'PAUSA',
          };

          /**
           * Ni colaborar ni ser administrador global concede
           * permiso para editar los datos de este proyecto.
           */
          for (const solicitante of [colaborador, administrador]) {
            await assert.rejects(
              () =>
                service.actualizar(
                  creado.id_proyecto,
                  solicitante,
                  datosActualizados,
                ),
              (error) => {
                assert.ok(error instanceof NotFoundException);
                assert.equal(error.getStatus(), 404);
                return true;
              },
            );
          }

          // Los intentos rechazados no deben cambiar el proyecto.
          const antes = await client.query(
            `
              SELECT nombre, estado_proyecto
              FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [creado.id_proyecto],
          );

          assert.deepEqual(antes.rows, [
            {
              nombre: 'Proyecto original',
              estado_proyecto: 'ACTIVA',
            },
          ]);

          // El propietario sí puede reemplazar los datos.
          const actualizado = await service.actualizar(
            creado.id_proyecto,
            propietario,
            datosActualizados,
          );

          assert.deepEqual(actualizado, {
            id_proyecto: creado.id_proyecto,
            id_propietario: propietario,
            nombre: 'Proyecto actualizado',
            descripcion: 'Descripción actualizada',
            direccion: 'Dirección actualizada',
            contratante: 'Cliente actualizado',
            fecha_inicio: '2026-09-09',
            fecha_finalizacion: null,
            estado_proyecto: 'PAUSA',
            activo: true,
            latitud: null,
            longitud: null,
          });

          // Confirma que los opcionales omitidos quedaron en NULL.
          const almacenado = await client.query(
            `
              SELECT
                id_propietario,
                nombre,
                fecha_finalizacion,
                estado_proyecto,
                activo,
                latitud,
                longitud
              FROM obra.proyectos
              WHERE id_proyecto = $1::uuid
            `,
            [creado.id_proyecto],
          );

          assert.deepEqual(almacenado.rows, [
            {
              id_propietario: propietario,
              nombre: 'Proyecto actualizado',
              fecha_finalizacion: null,
              estado_proyecto: 'PAUSA',
              activo: true,
              latitud: null,
              longitud: null,
            },
          ]);

          // La relación de colaboración permanece intacta.
          const colaboradores = await client.query(
            `
              SELECT id_usuario
              FROM obra.usuario_proyecto
              WHERE id_proyecto = $1::uuid
            `,
            [creado.id_proyecto],
          );

          assert.deepEqual(colaboradores.rows, [
            { id_usuario: colaborador },
          ]);

          /**
           * Deben existir solo dos actividades:
           * creación y edición satisfactoria.
           * Los intentos rechazados no generan una modificación.
           */
          const historial = await client.query(
            `
              SELECT id_actor, tipo_accion, mensaje
              FROM obra.actividades
              WHERE id_proyecto = $1::uuid
              ORDER BY tipo_accion
            `,
            [creado.id_proyecto],
          );

          assert.deepEqual(historial.rows, [
            {
              id_actor: propietario,
              tipo_accion: 'PROYECTO_CREADO',
              mensaje: 'Proyecto creado.',
            },
            {
              id_actor: propietario,
              tipo_accion: 'PROYECTO_MODIFICADO',
              mensaje: 'Datos del proyecto actualizados.',
            },
          ]);

          throw rollbackDeLimpieza;
        }),
      (error) => {
        // Cualquier error distinto debe hacer fallar la prueba.
        assert.strictEqual(error, rollbackDeLimpieza);
        return true;
      },
    );
  } finally {
    await database.onApplicationShutdown();
  }
});