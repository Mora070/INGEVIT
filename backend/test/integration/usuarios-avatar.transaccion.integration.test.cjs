require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  UsuariosAvatarRepository,
} = require('../../dist/modules/usuarios/usuarios-avatar.repository');

const {
  UsuariosAvatarService,
} = require('../../dist/modules/usuarios/usuarios-avatar.service');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

/**
 * Crea una cuenta exclusiva de la prueba.
 * Las referencias representan archivos ficticios: no se escribe en disco.
 *
 * El servicio ejecuta transacciones reales y los cambios se consultan
 * después desde el pool, fuera de esas transacciones.
 */
async function conCuenta(ejecutar) {
  const database = new DatabaseService();
  const id = randomUUID();

  const anterior = {
    url: `/avatar-prueba/${randomUUID()}.webp`,
    clave: `avatares/${randomUUID()}.webp`,
  };

  const nuevo = {
    url: `/avatar-prueba/${randomUUID()}.webp`,
    clave: `avatares/${randomUUID()}.webp`,
  };

  await database.onModuleInit();

  try {
    await database.query(
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
        id,
        `${id}@example.invalid`,
        `avatar-transaccion-${id}`,
        anterior.url,
        anterior.clave,
      ],
    );

    await ejecutar({ database, id, anterior, nuevo });
  } finally {
    try {
      // Retira únicamente los datos pertenecientes a esta prueba.
      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [id],
        );

        await client.query(
          `
            DELETE FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = ANY($1::text[])
          `,
          [[anterior.clave, nuevo.clave]],
        );
      });
    } finally {
      await database.onApplicationShutdown();
    }
  }
}

async function consultarAvatar(database, id) {
  const resultado = await database.query(
    `
      SELECT foto_perfil_url, foto_perfil_key
      FROM obra.usuarios
      WHERE id_usuario = $1
    `,
    [id],
  );

  assert.equal(resultado.rowCount, 1);
  return resultado.rows[0];
}

async function consultarPendientes(database, claves) {
  const resultado = await database.query(
    `
      SELECT s3_key
      FROM obra.archivos_pendientes_eliminacion
      WHERE s3_key = ANY($1::text[])
      ORDER BY s3_key
    `,
    [claves],
  );

  return resultado.rows.map((fila) => fila.s3_key);
}

test('avatar: confirma la nueva referencia y la limpieza del anterior juntas', async () => {
  await conCuenta(async ({ database, id, anterior, nuevo }) => {
    const service = new UsuariosAvatarService(
      database,
      new UsuariosAvatarRepository(),
      new ArchivosPendientesRepository(),
    );

    await service.cambiarReferencia(id, nuevo);

    assert.deepEqual(await consultarAvatar(database, id), {
      foto_perfil_url: nuevo.url,
      foto_perfil_key: nuevo.clave,
    });

    assert.deepEqual(
      await consultarPendientes(database, [anterior.clave, nuevo.clave]),
      [anterior.clave],
    );
  });
});

test('avatar: revierte la referencia y la tarea si falla la operación de limpieza', async () => {
  await conCuenta(async ({ database, id, anterior, nuevo }) => {
    const errorEsperado = new Error('Fallo deliberado después del INSERT');
    const repositoryReal = new ArchivosPendientesRepository();

    const pendientesConFallo = {
      async registrar(client, claves) {
        // Ejecuta el INSERT real antes de provocar el fallo.
        // Así comprobamos que PostgreSQL revierte ambas escrituras.
        await repositoryReal.registrar(client, claves);
        throw errorEsperado;
      },
    };

    const service = new UsuariosAvatarService(
      database,
      new UsuariosAvatarRepository(),
      pendientesConFallo,
    );

    await assert.rejects(
      () => service.cambiarReferencia(id, nuevo),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(await consultarAvatar(database, id), {
      foto_perfil_url: anterior.url,
      foto_perfil_key: anterior.clave,
    });

    assert.deepEqual(
      await consultarPendientes(database, [anterior.clave, nuevo.clave]),
      [],
    );
  });
});