require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  GoogleCuentasRepository,
} = require('../../dist/modules/auth/google-cuentas.repository');

/**
 * Ejecuta el SQL real dentro de una transacción que se revierte.
 *
 * El adaptador permite al repositorio utilizar el mismo cliente.
 * Aquí comprobamos persistencia; la verificación del token se prueba
 * por separado antes de permitir llamadas a este repositorio.
 */
test('Google cuentas: crea por sub, conserva perfiles y rechaza vinculación automática por correo', async () => {
  const database = new DatabaseService();
  const finalizar = new Error('Reversión deliberada');

  await database.onModuleInit();

  try {
    await assert.rejects(
      database.withTransaction(async (client) => {
        const repository = new GoogleCuentasRepository({
          withTransaction: (operacion) => operacion(client),
        });

        const identidad = {
          sub: `google-${randomUUID()}`,
          correo: `${randomUUID()}@example.invalid`,
          nombre: 'Ana',
          apellidos: 'Pérez',
        };

        // Primera autenticación: crea una cuenta exclusiva de Google.
        const creada = await repository.obtenerOCrear(identidad);

        assert.ok(creada);
        assert.equal(creada.google_sub, identidad.sub);
        assert.equal(creada.correo, identidad.correo);
        assert.equal(creada.nombre, 'Ana');
        assert.equal(creada.apellidos, 'Pérez');
        assert.equal(creada.password_hash, null);
        assert.equal(creada.foto_perfil_url, null);
        assert.equal(creada.rol, 'USUARIO');
        assert.equal(creada.estado, 'ACTIVO');
        assert.equal(creada.version_sesion, 0);

        // Un nuevo login no duplica la cuenta.
        const repetida = await repository.obtenerOCrear(identidad);
        assert.equal(repetida.id_usuario, creada.id_usuario);

        const cantidad = await client.query(
          'SELECT id_usuario FROM obra.usuarios WHERE google_sub = $1',
          [identidad.sub],
        );
        assert.equal(cantidad.rowCount, 1);

        // Los datos que el usuario editó en INGEVIT se conservan.
        const claveAvatar = `avatares/${randomUUID()}.webp`;

        await client.query(
          `
            UPDATE obra.usuarios
            SET nombre = 'Nombre elegido',
                apellidos = 'Apellidos elegidos',
                foto_perfil_url = $2,
                foto_perfil_key = $3,
                version_sesion = 3
            WHERE id_usuario = $1
          `,
          [
            creada.id_usuario,
            `/api/usuarios/${creada.id_usuario}/avatar`,
            claveAvatar,
          ],
        );

        const conservada = await repository.obtenerOCrear({
          ...identidad,
          correo: `${randomUUID()}@example.invalid`,
          nombre: 'Otro nombre de Google',
          apellidos: 'Otros apellidos',
        });

        // sub mantiene la identidad aunque Google comunique otro correo.
        assert.equal(conservada.id_usuario, creada.id_usuario);
        assert.equal(conservada.correo, identidad.correo);
        assert.equal(conservada.nombre, 'Nombre elegido');
        assert.equal(conservada.apellidos, 'Apellidos elegidos');
        assert.equal(
          conservada.foto_perfil_url,
          `/api/usuarios/${creada.id_usuario}/avatar`,
        );
        assert.equal(conservada.version_sesion, 3);

        // El repositorio no reactiva cuentas; el servicio rechazará el login.
        await client.query(
          "UPDATE obra.usuarios SET estado = 'INACTIVO' WHERE id_usuario = $1",
          [creada.id_usuario],
        );

        const inactiva = await repository.obtenerOCrear(identidad);
        assert.equal(inactiva.id_usuario, creada.id_usuario);
        assert.equal(inactiva.estado, 'INACTIVO');

        // Una cuenta local con el mismo correo no se vincula automáticamente.
        const idLocal = randomUUID();
        const correoLocal = `${idLocal}@example.invalid`;

        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario, correo, password_hash
            )
            VALUES ($1, $2, 'hash-local-de-prueba')
          `,
          [idLocal, correoLocal],
        );

        assert.equal(
          await repository.obtenerOCrear({
            sub: `otro-google-${randomUUID()}`,
            correo: correoLocal.toUpperCase(),
            nombre: 'No debe guardarse',
            apellidos: null,
          }),
          null,
        );

        const local = await client.query(
          `
            SELECT google_sub, password_hash
            FROM obra.usuarios
            WHERE id_usuario = $1
          `,
          [idLocal],
        );

        assert.deepEqual(local.rows[0], {
          google_sub: null,
          password_hash: 'hash-local-de-prueba',
        });

        // Tampoco vincula otra identidad Google por coincidir el correo.
        assert.equal(
          await repository.obtenerOCrear({
            ...identidad,
            sub: `sub-diferente-${randomUUID()}`,
          }),
          null,
        );

        // Los nombres son opcionales para una nueva cuenta.
        const sinNombre = await repository.obtenerOCrear({
          sub: `sin-nombre-${randomUUID()}`,
          correo: `${randomUUID()}@example.invalid`,
          nombre: null,
          apellidos: null,
        });

        assert.ok(sinNombre);
        assert.equal(sinNombre.nombre, null);
        assert.equal(sinNombre.apellidos, null);
        assert.equal(sinNombre.password_hash, null);

        throw finalizar;
      }),
      (error) => error === finalizar,
    );
  } finally {
    await database.onApplicationShutdown();
  }
});