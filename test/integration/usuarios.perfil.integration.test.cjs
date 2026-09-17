require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  UsuariosRepository,
} = require('../../dist/modules/usuarios/usuarios.repository');

/**
 * Ejecuta el repositorio contra PostgreSQL real.
 *
 * Todas las consultas utilizan el cliente de una misma transacción,
 * que se revierte deliberadamente al finalizar.
 *
 * El adaptador query no simula resultados: dirige el SQL real
 * del repositorio hacia ese cliente para aislar los datos de prueba.
 */
test('perfil: actualiza parcialmente y protege las cuentas y campos restantes', async () => {
  const database = new DatabaseService();

  const usuario = randomUUID();
  const otroUsuario = randomUUID();
  const finPrueba = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const repository = new UsuariosRepository({
          query: (sql, values) => client.query(sql, values),
        });

        for (const id of [usuario, otroUsuario]) {
          await client.query(
            `
              INSERT INTO obra.usuarios (
                id_usuario,
                nombre,
                apellidos,
                correo,
                telefono,
                ubicacion,
                foto_perfil_url,
                google_sub,
                rol,
                estado,
                foto_perfil_key
              )
              VALUES (
                $1,
                'Nombre inicial',
                'Apellidos iniciales',
                $2,
                '+57 300 000 0000',
                'Bogotá',
                '/perfil-prueba.webp',
                $3,
                'USUARIO',
                'ACTIVO',
                'avatares/' || $1::uuid::text || '.webp'
              )
            `,
            [
              id,
              `${id}@example.invalid`,
              `perfil-integracion-${id}`,
            ],
          );
        }

        const inicial = await repository.findById(usuario);
        const otroInicial = await repository.findById(otroUsuario);

        assert.ok(inicial);
        assert.ok(otroInicial);

        // Cambia nombre y elimina teléfono.
        // Los demás campos deben conservarse exactamente.
        const primera = await repository.actualizarPerfil(usuario, {
          nombre: 'Ana María',
          telefono: null,
        });

        assert.deepEqual(primera, {
          ...inicial,
          nombre: 'Ana María',
          telefono: null,
        });

        // Otra actualización parcial no sobrescribe los cambios anteriores.
        const segunda = await repository.actualizarPerfil(usuario, {
          ubicacion: 'Medellín, Colombia',
        });

        assert.deepEqual(segunda, {
          ...primera,
          ubicacion: 'Medellín, Colombia',
        });

        // null elimina también nombre y apellidos.
        const tercera = await repository.actualizarPerfil(usuario, {
          nombre: null,
          apellidos: null,
        });

        assert.deepEqual(tercera, {
          ...segunda,
          nombre: null,
          apellidos: null,
        });

        // El contenido se almacena como un valor, nunca como SQL.
        const texto = "Ana', rol = 'ADMINISTRADOR' --";

        const cuarta = await repository.actualizarPerfil(usuario, {
          nombre: texto,
        });

        assert.deepEqual(cuarta, {
          ...tercera,
          nombre: texto,
        });

        assert.equal(cuarta.rol, 'USUARIO');

        // El usuario ajeno permanece intacto.
        assert.deepEqual(
          await repository.findById(otroUsuario),
          otroInicial,
        );

        // Una cuenta inactiva no puede actualizar su perfil.
        await client.query(
          `
            UPDATE obra.usuarios
            SET estado = 'INACTIVO'
            WHERE id_usuario = $1
          `,
          [usuario],
        );

        const antesDelIntento = await repository.findById(usuario);

        assert.equal(
          await repository.actualizarPerfil(usuario, {
            nombre: 'Cambio que no debe aplicarse',
            telefono: '+57 311 111 1111',
          }),
          null,
        );

        assert.deepEqual(
          await repository.findById(usuario),
          antesDelIntento,
        );

        // Un identificador inexistente tampoco modifica otra cuenta.
        assert.equal(
          await repository.actualizarPerfil(randomUUID(), {
            nombre: 'Inexistente',
          }),
          null,
        );

        assert.deepEqual(
          await repository.findById(otroUsuario),
          otroInicial,
        );

        throw finPrueba;
      }),
      (error) => error === finPrueba,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});