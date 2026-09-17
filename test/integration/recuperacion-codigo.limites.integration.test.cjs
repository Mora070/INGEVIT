require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  RecuperacionCodigoRepository,
} = require('../../dist/modules/auth/recuperacion-codigo.repository');

test('recuperación: limita emisiones, conserva el código rechazado y renueva la ventana', async () => {
  const database = new DatabaseService();
  const repository = new RecuperacionCodigoRepository();
  const id = randomUUID();
  const correo = `${id}@example.invalid`;
  const secreto = randomBytes(32);

  await database.onModuleInit();

  const emitir = (codigo) => database.withTransaction(
    (client) => repository.emitir(client, correo, codigo, secreto),
  );

  async function permitirIntervalo() {
    await database.query(
      `
        UPDATE obra.recuperacion_limites
        SET inicio_ventana = clock_timestamp() - interval '10 minutes',
            ultima_emision = clock_timestamp() - interval '61 seconds'
        WHERE id_usuario = $1
      `,
      [id],
    );
  }

  try {
    await database.query(
      `
        INSERT INTO obra.usuarios (id_usuario, correo, password_hash)
        VALUES ($1, $2, 'hash-ficticio')
      `,
      [id, correo],
    );

    assert.equal(await emitir('00000001'), correo);

    const antes = await database.query(
      'SELECT token_hash FROM obra.recuperaciones_password WHERE id_usuario = $1',
      [id],
    );

    // Rechaza una solicitud inmediata sin reemplazar el código.
    assert.equal(await emitir('99999999'), null);

    const despues = await database.query(
      'SELECT token_hash FROM obra.recuperaciones_password WHERE id_usuario = $1',
      [id],
    );
    assert.deepEqual(despues.rows, antes.rows);

    for (let numero = 2; numero <= 5; numero += 1) {
      await permitirIntervalo();
      assert.equal(
        await emitir(String(numero).padStart(8, '0')),
        correo,
      );
    }

    // Aunque haya pasado un minuto, la sexta emisión sigue bloqueada.
    await permitirIntervalo();
    assert.equal(await emitir('00000006'), null);

    // Consumir la solicitud no elimina el límite de emisiones.
    assert.equal(
      await database.withTransaction((client) =>
        repository.consumir(
          client, correo, '00000005', 'otro-hash-ficticio', secreto,
        ),
      ),
      true,
    );
    assert.equal(await emitir('00000007'), null);

    // Al vencer la ventana, vuelve a permitirse una emisión.
    await database.query(
      `
        UPDATE obra.recuperacion_limites
        SET inicio_ventana = clock_timestamp() - interval '61 minutes',
            ultima_emision = clock_timestamp() - interval '2 minutes'
        WHERE id_usuario = $1
      `,
      [id],
    );

    assert.equal(await emitir('00000008'), correo);

    const limite = await database.query(
      'SELECT emisiones FROM obra.recuperacion_limites WHERE id_usuario = $1',
      [id],
    );
    assert.equal(limite.rows[0].emisiones, 1);
  } finally {
    try {
      // Ambas tablas auxiliares se limpian mediante ON DELETE CASCADE.
      await database.query(
        'DELETE FROM obra.usuarios WHERE id_usuario = $1',
        [id],
      );
    } finally {
      await database.onApplicationShutdown();
    }
  }
});