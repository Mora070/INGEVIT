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
 * Comprueba la actualización condicional con PostgreSQL real.
 *
 * Los hashes son textos de prueba: aquí verificamos la persistencia,
 * no Argon2. La verificación criptográfica pertenece a PasswordService.
 *
 * Todos los datos se revierten al finalizar.
 */
test('password: exige el hash vigente y conserva cuentas no modificables', async () => {
    const database = new DatabaseService();

    const activo = randomUUID();
    const inactivo = randomUUID();
    const soloGoogle = randomUUID();

    const hashAnterior = 'hash-anterior-de-prueba';
    const hashNuevo = 'hash-nuevo-de-prueba';
    const finPrueba = new Error('Reversión deliberada');

    await database.onModuleInit();

    try {
        await assert.rejects(
            database.withTransaction(async (client) => {
                // El SQL del repositorio utiliza esta transacción real.
                const repository = new UsuariosRepository({
                    query: (sql, values) => client.query(sql, values),
                });

                for (const id of [activo, inactivo, soloGoogle]) {
                    await client.query(
                        `
              INSERT INTO obra.usuarios (
                id_usuario,
                correo,
                nombre,
                password_hash,
                google_sub,
                estado
              )
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
                        [
                            id,
                            `${id}@example.invalid`,
                            'Persona de prueba',
                            id === soloGoogle ? null : hashAnterior,
                            id === soloGoogle ? `google-prueba-${id}` : null,
                            id === inactivo ? 'INACTIVO' : 'ACTIVO',
                        ],
                    );
                }

                const activoInicial = await repository.findById(activo);
                const inactivoInicial = await repository.findById(inactivo);
                const googleInicial = await repository.findById(soloGoogle);



                assert.ok(activoInicial);
                assert.ok(inactivoInicial);
                assert.ok(googleInicial);

                assert.equal(activoInicial.version_sesion, 0);
                assert.equal(inactivoInicial.version_sesion, 0);
                assert.equal(googleInicial.version_sesion, 0);

                // Un hash que no coincide no permite actualizar.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        activo,
                        'hash-incorrecto',
                        hashNuevo,
                    ),
                    false,
                );

                assert.deepEqual(
                    await repository.findById(activo),
                    activoInicial,
                );

                // La cuenta activa conserva el hash esperado: actualización válida.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        activo,
                        hashAnterior,
                        hashNuevo,
                    ),
                    true,
                );

                const activoActualizado = await repository.findById(activo);

                assert.deepEqual(activoActualizado, {
                    ...activoInicial,
                    password_hash: hashNuevo,
                    version_sesion: activoInicial.version_sesion + 1,
                });

                // Una operación que verificó el hash anterior ya no puede
                // sobrescribir el cambio confirmado.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        activo,
                        hashAnterior,
                        'otro-hash-que-no-debe-guardarse',
                    ),
                    false,
                );

                assert.deepEqual(
                    await repository.findById(activo),
                    activoActualizado,
                );

                // La cuenta inactiva permanece intacta aunque coincida el hash.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        inactivo,
                        hashAnterior,
                        hashNuevo,
                    ),
                    false,
                );

                assert.deepEqual(
                    await repository.findById(inactivo),
                    inactivoInicial,
                );

                // Esta operación no permite asignar contraseña a una cuenta Google.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        soloGoogle,
                        hashAnterior,
                        hashNuevo,
                    ),
                    false,
                );

                assert.deepEqual(
                    await repository.findById(soloGoogle),
                    googleInicial,
                );

                // Tampoco crea cuentas cuando el identificador no existe.
                assert.equal(
                    await repository.actualizarPasswordSiCoincide(
                        randomUUID(),
                        hashAnterior,
                        hashNuevo,
                    ),
                    false,
                );

                throw finPrueba;
            }),
            (error) => error === finPrueba,
        );
    } finally {
        await database.onApplicationShutdown();
    }
});