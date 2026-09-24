require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    PropietarioCapaGuard,
} = require('../dist/modules/capas/guards/propietario-capa.guard');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const OTRO_USUARIO = '10000000-0000-4000-8000-000000000003';

function contexto({
    usuario = { id_usuario: ID_USUARIO },
    idProyecto = ID_PROYECTO,
} = {}) {
    return {
        switchToHttp() {
            return {
                getRequest() {
                    return {
                        usuario,
                        params: { idProyecto },
                        // Estos datos no deben influir en la autorización.
                        body: { id_usuario: OTRO_USUARIO },
                        headers: { 'x-user-id': OTRO_USUARIO },
                    };
                },
            };
        },
    };
}

function comprobarEstado(estado) {
    return (error) => {
        assert.equal(error.getStatus(), estado);
        return true;
    };
}

test('propietario de capa: permite al propietario usando la identidad de sesión', async () => {
    const llamadas = [];
    const guard = new PropietarioCapaGuard({
        async findDisponibleById(...argumentos) {
            llamadas.push(argumentos);
            return { id_propietario: ID_USUARIO };
        },
    });

    assert.equal(await guard.canActivate(contexto()), true);
    assert.deepEqual(llamadas, [[ID_PROYECTO, ID_USUARIO]]);
});

test('propietario de capa: rechaza la ausencia de sesión sin consultar el proyecto', async () => {
    let llamadas = 0;
    const guard = new PropietarioCapaGuard({
        async findDisponibleById() {
            llamadas += 1;
        },
    });

    await assert.rejects(
        guard.canActivate(contexto({ usuario: null })),
        comprobarEstado(401),
    );

    assert.equal(llamadas, 0);
});

test('propietario de capa: rechaza identificadores inválidos antes de consultar', async () => {
    let llamadas = 0;
    const guard = new PropietarioCapaGuard({
        async findDisponibleById() {
            llamadas += 1;
        },
    });

    for (const idProyecto of [
        '',
        'no-es-un-uuid',
        `${ID_PROYECTO}' OR true --`,
        [ID_PROYECTO],
    ]) {
        await assert.rejects(
            guard.canActivate(contexto({ idProyecto })),
            comprobarEstado(400),
        );
    }

    assert.equal(llamadas, 0);
});

test('propietario de capa: rechaza proyectos no disponibles', async () => {
    const guard = new PropietarioCapaGuard({
        async findDisponibleById() {
            return null;
        },
    });

    await assert.rejects(
        guard.canActivate(contexto()),
        comprobarEstado(404),
    );
});

test('propietario de capa: un colaborador no obtiene permiso de gestión', async () => {
    const guard = new PropietarioCapaGuard({
        async findDisponibleById() {
            return { id_propietario: OTRO_USUARIO };
        },
    });

    await assert.rejects(
        guard.canActivate(contexto()),
        comprobarEstado(404),
    );
});

test('propietario de capa: propaga errores de infraestructura', async () => {
    const fallo = new Error('PostgreSQL no disponible');
    const guard = new PropietarioCapaGuard({
        async findDisponibleById() {
            throw fallo;
        },
    });

    await assert.rejects(
        guard.canActivate(contexto()),
        (error) => error === fallo,
    );
});