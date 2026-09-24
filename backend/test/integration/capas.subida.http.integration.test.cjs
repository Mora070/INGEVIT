require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { dirname, join } = require('node:path');
const { readFile, readdir } = require('node:fs/promises');

const {
    conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');
const {
    DatabaseService,
} = require('../../dist/database/database.service');
const {
    PasswordService,
} = require('../../dist/modules/auth/services/password.service');
const {
    AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');
const {
    ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');
const {
    getGdalConfig,
} = require('../../dist/modules/capas/config/gdal.config');

const {
    CapasProcesamientoService,
} = require('../../dist/modules/capas/capas-procesamiento.service');

const {
    verificarTeselas,
} = require('../../dist/modules/capas/utils/verificar-teselas');


const {
    CapasLimpiezaService,
} = require('../../dist/modules/capas/capas-limpieza.service');

const ejecutar = promisify(execFile);

/**
 * Usa HTTP, PostgreSQL, almacenamiento y GDAL reales.
 * Genera un archivo pequeño y limpia exclusivamente sus propios registros.
 *
 * El límite de 64 KiB pertenece a esta prueba, no al producto.
 */
test('capas HTTP: recibe el original, aplica permisos y compensa una transacción fallida', async (t) => {
    const limiteAnterior = process.env.CAPAS_MAX_ARCHIVO_BYTES;
    process.env.CAPAS_MAX_ARCHIVO_BYTES = '65536';

    try {
        await conAplicacionReal(async ({
            app,
            baseUrl,
            origen,
            raizTemporal,
        }) => {
            const database = app.get(DatabaseService);
            const passwords = app.get(PasswordService);

            const propietario = randomUUID();
            const colaborador = randomUUID();
            const proyecto = randomUUID();
            const password = 'Clave temporal de capas-2026';
            const hash = await passwords.generarHash(password);

            try {
                await database.withTransaction(async (client) => {
                    for (const usuario of [propietario, colaborador]) {
                        await client.query(
                            `
                                INSERT INTO obra.usuarios (
                                    id_usuario, correo, password_hash
                                )
                                VALUES ($1, $2, $3)
                            `,
                            [usuario, `${usuario}@example.invalid`, hash],
                        );
                    }

                    await client.query(
                        `
                            INSERT INTO obra.proyectos (
                                id_proyecto, id_propietario, nombre,
                                descripcion, direccion, contratante,
                                fecha_inicio, estado_proyecto
                            )
                            VALUES (
                                $1, $2, 'Prueba subida GeoTIFF',
                                'Integración', 'Dirección temporal',
                                'Contratante temporal', '2026-09-23', 'ACTIVA'
                            )
                        `,
                        [proyecto, propietario],
                    );

                    await client.query(
                        `
                            INSERT INTO obra.usuario_proyecto (
                                id_usuario, id_proyecto
                            )
                            VALUES ($1, $2)
                        `,
                        [colaborador, proyecto],
                    );
                });

                const config = getGdalConfig();
                const creador = join(
                    dirname(config.ejecutableInfo),
                    process.platform === 'win32'
                        ? 'gdal_create.exe'
                        : 'gdal_create',
                );

                // Fuera de la carpeta de originales administrados por la aplicación.
                const fixture = join(raizTemporal, 'fixture-geotiff.tif');

                await ejecutar(creador, [
                    '-of', 'GTiff',
                    '-ot', 'Byte',
                    '-outsize', '16', '8',
                    '-bands', '3',
                    '-burn', '80',
                    '-a_srs', 'EPSG:4326',
                    '-a_ullr', '-74.1', '4.7', '-74.0', '4.6',
                    fixture,
                ], {
                    encoding: 'utf8',
                    shell: false,
                    windowsHide: true,
                    timeout: config.timeoutInfoMs,
                    maxBuffer: 4 * 1024 * 1024,
                    env: {
                        ...process.env,
                        GDAL_DATA: config.directorioDatosGdal,
                        PROJ_DATA: config.directorioDatosProj,
                        PROJ_NETWORK: 'OFF',
                        GDAL_PAM_ENABLED: 'NO',
                    },
                });

                const original = await readFile(fixture);
                assert.ok(original.length < 65536);

                async function login(usuario) {
                    const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
                        method: 'POST',
                        headers: {
                            Origin: origen,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            correo: `${usuario}@example.invalid`,
                            password,
                        }),
                    });

                    const cuerpo = await respuesta.json();
                    assert.equal(respuesta.status, 200, JSON.stringify(cuerpo));

                    const cookie = respuesta.headers.getSetCookie().find(
                        (valor) => valor.startsWith(`${AUTH_COOKIE_NAME}=`),
                    );

                    assert.ok(cookie);
                    return cookie.split(';')[0];
                }

                const cookiePropietario = await login(propietario);
                const cookieColaborador = await login(colaborador);

                async function subir(cookie, contenido = original) {
                    const formulario = new FormData();
                    formulario.append('nombre', '  Ortofoto de prueba  ');
                    formulario.append('descripcion', 'Archivo generado por GDAL');
                    formulario.append(
                        'archivo',
                        new Blob([contenido], { type: 'image/tiff' }),
                        'levantamiento.tif',
                    );

                    const respuesta = await fetch(
                        `${baseUrl}/api/proyectos/${proyecto}/capas`,
                        {
                            method: 'POST',
                            headers: {
                                Origin: origen,
                                ...(cookie ? { Cookie: cookie } : {}),
                            },
                            body: formulario,
                        },
                    );

                    return {
                        status: respuesta.status,
                        cache: respuesta.headers.get('cache-control'),
                        cuerpo: await respuesta.json(),
                    };
                }

                async function filas() {
                    return (await database.query(
                        'SELECT * FROM obra.capas WHERE id_proyecto = $1',
                        [proyecto],
                    )).rows;
                }

                async function archivos() {
                    return (await readdir(join(raizTemporal, 'capas'))).sort();
                }

                // Ni visitantes ni colaboradores pueden crear capas.
                assert.equal((await subir()).status, 401);
                assert.equal((await subir(cookieColaborador)).status, 404);
                assert.deepEqual(await filas(), []);
                assert.deepEqual(await archivos(), []);

                // El tamaño y el contenido se validan antes de persistir.
                assert.equal(
                    (await subir(cookiePropietario, Buffer.alloc(65537))).status,
                    413,
                );
                assert.equal(
                    (await subir(cookiePropietario, Buffer.from('No es TIFF'))).status,
                    422,
                );
                assert.deepEqual(await filas(), []);
                assert.deepEqual(await archivos(), []);

                const creada = await subir(cookiePropietario);

                assert.equal(creada.status, 201, JSON.stringify(creada.cuerpo));
                assert.equal(creada.cache, 'no-store');
                assert.equal(creada.cuerpo.nombre, 'Ortofoto de prueba');
                assert.equal(creada.cuerpo.estado_procesamiento, 'PENDIENTE');
                assert.equal(creada.cuerpo.teselas, null);
                assert.equal(
                    creada.cuerpo.tamano_original_bytes,
                    String(original.length),
                );

                for (const campo of [
                    'original_key',
                    'almacenamiento_proveedor',
                    'mapbox_tileset_id',
                    'mapbox_job_id',
                    'error_procesamiento',
                ]) {
                    assert.equal(Object.hasOwn(creada.cuerpo, campo), false);
                }

                const guardadas = await filas();
                assert.equal(guardadas.length, 1);

                const capa = guardadas[0];
                assert.equal(capa.id_capa, creada.cuerpo.id_capa);
                assert.equal(capa.id_usuario_subida, propietario);
                assert.equal(capa.almacenamiento_proveedor, 'LOCAL');
                assert.match(capa.crs_original, /4326/);
                assert.match(capa.original_key, /^capas\/[0-9a-f-]{36}\.tif$/);

                const bbox = [-74.1, 4.6, -74, 4.7];
                for (let i = 0; i < bbox.length; i += 1) {
                    assert.ok(Math.abs(creada.cuerpo.bbox[i] - bbox[i]) < 1e-8);
                }

                assert.deepEqual(
                    await readFile(join(raizTemporal, ...capa.original_key.split('/'))),
                    original,
                );

                const historial = await database.query(
                    `
                        SELECT id_actor, tipo_accion
                        FROM obra.actividades
                        WHERE id_proyecto = $1
                    `,
                    [proyecto],
                );

                assert.deepEqual(historial.rows, [{
                    id_actor: propietario,
                    tipo_accion: 'CAPA_CREADA',
                }]);

                // El colaborador puede consultar la capa pendiente.
                const consulta = await fetch(
                    `${baseUrl}/api/proyectos/${proyecto}/capas`,
                    { headers: { Cookie: cookieColaborador } },
                );

                assert.equal(consulta.status, 200);
                const listado = await consulta.json();
                assert.equal(listado.total, 1);
                assert.deepEqual(listado.capas, [creada.cuerpo]);

                /*
                 * Fuerza un error SQL real al registrar el historial.
                 * La capa nueva debe revertirse y su archivo compensarse.
                 */
                const archivosAntes = await archivos();
                const actividades = app.get(ActividadesRepository);

                const fallo = t.mock.method(
                    actividades,
                    'crear',
                    async (client, datos) => {
                        await client.query(
                            `
                                INSERT INTO obra.actividades (
                                    id_proyecto, id_actor, tipo_accion, mensaje
                                )
                                VALUES ($1, $2, $3, NULL)
                            `,
                            [datos.idProyecto, datos.idActor, datos.tipoAccion],
                        );
                    },
                );

                try {
                    assert.equal((await subir(cookiePropietario)).status, 500);
                    assert.equal(fallo.mock.callCount(), 1);
                } finally {
                    fallo.mock.restore();
                }

                assert.deepEqual(await filas(), guardadas);
                assert.deepEqual(await archivos(), archivosAntes);

                const historialDespues = await database.query(
                    `
                        SELECT id_actor, tipo_accion
                        FROM obra.actividades
                        WHERE id_proyecto = $1
                    `,
                    [proyecto],
                );

                assert.deepEqual(historialDespues.rows, historial.rows);

                /*
 * Comprueba el procesamiento con GDAL, PostgreSQL y archivos reales.
 *
 * El zoom y los límites siguientes pertenecen exclusivamente a esta
 * prueba. Se restauran incluso si alguna comprobación falla.
 */
                const configuracionPrueba = {
                    CAPAS_TESELAS_ZOOM_MIN: '12',
                    CAPAS_TESELAS_ZOOM_MAX: '12',
                    CAPAS_TESELAS_HILOS: '1',
                    CAPAS_TESELAS_TIMEOUT_MS: '60000',
                    CAPAS_TESELAS_MAX_ARCHIVOS: '100',
                };

                const configuracionAnterior = new Map(
                    Object.keys(configuracionPrueba).map(
                        (nombre) => [nombre, process.env[nombre]],
                    ),
                );

                Object.assign(process.env, configuracionPrueba);

                try {
                    const procesamiento = app.get(CapasProcesamientoService);

                    async function consultarCapa(idCapa) {
                        const resultado = await database.query(
                            `
                SELECT *
                FROM obra.capas
                WHERE id_proyecto = $1 AND id_capa = $2
            `,
                            [proyecto, idCapa],
                        );

                        assert.equal(resultado.rows.length, 1);
                        return resultado.rows[0];
                    }

                    async function contarPublicaciones() {
                        const resultado = await database.query(
                            `
                SELECT count(*)::integer AS total
                FROM obra.actividades
                WHERE id_proyecto = $1
                  AND tipo_accion = 'CAPA_PROCESADA'
            `,
                            [proyecto],
                        );

                        return resultado.rows[0].total;
                    }

                    // El servicio también comprueba permisos, aunque se invoque sin HTTP.
                    await assert.rejects(
                        () => procesamiento.procesar(
                            proyecto,
                            capa.id_capa,
                            colaborador,
                        ),
                        (error) => error.getStatus?.() === 404,
                    );

                    assert.equal(
                        (await consultarCapa(capa.id_capa)).estado_procesamiento,
                        'PENDIENTE',
                    );

                    const lista = await procesamiento.procesar(
                        proyecto,
                        capa.id_capa,
                        propietario,
                    );

                    assert.equal(lista.estado_procesamiento, 'LISTA');
                    assert.ok(lista.teselas);
                    assert.equal(lista.teselas.zoom_min, 12);
                    assert.equal(lista.teselas.zoom_max, 12);
                    assert.equal(lista.teselas.tamano, 256);
                    assert.ok(BigInt(lista.teselas.total) > 0n);

                    for (const campo of [
                        'original_key',
                        'procesamiento_token',
                        'procesamiento_inicio',
                        'error_procesamiento',
                    ]) {
                        assert.equal(Object.hasOwn(lista, campo), false);
                    }

                    const publicada = await consultarCapa(capa.id_capa);

                    assert.equal(publicada.estado_procesamiento, 'LISTA');
                    assert.equal(publicada.procesamiento_token, null);
                    assert.equal(publicada.procesamiento_inicio, null);
                    assert.equal(publicada.error_procesamiento, null);
                    assert.equal(publicada.teselas_proveedor, 'LOCAL');
                    assert.equal(publicada.teselas_version, lista.teselas.version);
                    assert.equal(publicada.teselas_total, lista.teselas.total);

                    // Procesar no debe cambiar la configuración compartida de la capa.
                    assert.equal(publicada.opacidad, capa.opacidad);
                    assert.equal(publicada.visible, capa.visible);
                    assert.equal(publicada.orden, capa.orden);

                    const carpetaCapa = join(
                        raizTemporal,
                        'capas-teselas',
                        capa.id_capa,
                    );

                    const carpetaVersion = join(
                        carpetaCapa,
                        publicada.teselas_version,
                    );

                    assert.deepEqual(
                        await readdir(carpetaCapa),
                        [publicada.teselas_version],
                    );

                    assert.deepEqual(await readdir(carpetaVersion), ['tiles']);

                    // Comprueba la estructura XYZ y decodifica los PNG publicados.
                    const teselas = await verificarTeselas(
                        join(carpetaVersion, 'tiles'),
                        {
                            zoomMin: 12,
                            zoomMax: 12,
                            maxArchivos: 100,
                        },
                    );

                    assert.equal(String(teselas.length), publicada.teselas_total);

                    /*
 * La colección publicada debe poder descargarse por HTTP,
 * conservando la autorización y los bytes de la imagen.
 */
                    const primeraTesela = teselas[0];
                    assert.ok(primeraTesela);

                    const construirUrlTesela = (version) =>
                        `${baseUrl}/api/proyectos/${proyecto}/capas/`
                        + `${capa.id_capa}/teselas/${version}/`
                        + `${primeraTesela.z}/${primeraTesela.x}/${primeraTesela.y}.png`;

                    const urlTesela = construirUrlTesela(publicada.teselas_version);

                    // Sin sesión no debe entregarse el archivo.
                    const anonima = await fetch(urlTesela);
                    assert.equal(anonima.status, 401);
                    await anonima.arrayBuffer();

                    // Propietario y colaborador reciben exactamente el PNG publicado.
                    const pngEsperado = await readFile(primeraTesela.ruta);

                    for (const cookie of [cookiePropietario, cookieColaborador]) {
                        const respuesta = await fetch(urlTesela, {
                            headers: { Cookie: cookie },
                        });

                        assert.equal(respuesta.status, 200);
                        assert.match(
                            respuesta.headers.get('content-type') ?? '',
                            /^image\/png\b/,
                        );
                        assert.equal(
                            respuesta.headers.get('cache-control'),
                            'private, no-store',
                        );
                        assert.equal(
                            respuesta.headers.get('x-content-type-options'),
                            'nosniff',
                        );

                        assert.deepEqual(
                            Buffer.from(await respuesta.arrayBuffer()),
                            pngEsperado,
                        );
                    }

                    // Una versión distinta no puede acceder a los archivos publicados.
                    const versionDesconocida = await fetch(
                        construirUrlTesela(randomUUID()),
                        { headers: { Cookie: cookiePropietario } },
                    );

                    assert.equal(versionDesconocida.status, 404);
                    await versionDesconocida.arrayBuffer();

                    const urlDescriptor =
                        `${baseUrl}/api/proyectos/${proyecto}/capas/${capa.id_capa}`
                        + `/teselas/${publicada.teselas_version}/tilejson.json`;

                    const descriptorAnonimo = await fetch(urlDescriptor);
                    assert.equal(descriptorAnonimo.status, 401);
                    await descriptorAnonimo.arrayBuffer();

                    for (const cookie of [cookiePropietario, cookieColaborador]) {
                        const respuesta = await fetch(urlDescriptor, {
                            headers: { Cookie: cookie },
                        });

                        assert.equal(respuesta.status, 200);
                        assert.equal(
                            respuesta.headers.get('cache-control'),
                            'private, no-store',
                        );

                        const descriptor = await respuesta.json();

                        assert.equal(descriptor.tilejson, '3.0.0');
                        assert.equal(descriptor.scheme, 'xyz');
                        assert.equal(descriptor.name, publicada.nombre);
                        assert.equal(descriptor.minzoom, publicada.teselas_zoom_min);
                        assert.equal(descriptor.maxzoom, publicada.teselas_zoom_max);

                        assert.deepEqual(descriptor.bounds, [
                            Number(publicada.bbox_oeste),
                            Number(publicada.bbox_sur),
                            Number(publicada.bbox_este),
                            Number(publicada.bbox_norte),
                        ]);

                        assert.equal(descriptor.tiles.length, 1);

                        // La plantilla debe conducir a la tesela que ya comprobamos.
                        const urlDesdeDescriptor = descriptor.tiles[0]
                            .replace('{z}', String(primeraTesela.z))
                            .replace('{x}', String(primeraTesela.x))
                            .replace('{y}', String(primeraTesela.y));

                        assert.equal(urlDesdeDescriptor, urlTesela);
                        assert.equal(Object.hasOwn(descriptor, 'original_key'), false);
                    }

                    const descriptorInexistente = await fetch(
                        `${baseUrl}/api/proyectos/${proyecto}/capas/${capa.id_capa}`
                        + `/teselas/${randomUUID()}/tilejson.json`,
                        { headers: { Cookie: cookiePropietario } },
                    );

                    assert.equal(descriptorInexistente.status, 404);
                    await descriptorInexistente.arrayBuffer();

                    /*
 * Comprueba permisos con las mismas cookies y URLs ya utilizadas.
 * Así verificamos que cada solicitud consulta el acceso actual.
 *
 * Los cambios SQL siguientes afectan exclusivamente a los registros
 * temporales creados por esta prueba.
 */
                    async function comprobarAccesoRaster(cookie, estadoEsperado) {
                        for (const url of [urlDescriptor, urlTesela]) {
                            const respuesta = await fetch(url, {
                                headers: { Cookie: cookie },
                            });

                            const contenido = Buffer.from(await respuesta.arrayBuffer());

                            assert.equal(
                                respuesta.status,
                                estadoEsperado,
                                `Estado inesperado al consultar ${url}`,
                            );

                            if (estadoEsperado === 200 && url === urlTesela) {
                                assert.deepEqual(contenido, pngEsperado);
                            }

                            if (estadoEsperado !== 200) {
                                assert.match(
                                    respuesta.headers.get('content-type') ?? '',
                                    /application\/json/,
                                );
                            }
                        }
                    }

                    await t.test(
                        'raster: retirar al colaborador revoca el descriptor y las teselas',
                        async () => {
                            await database.query(
                                `
                DELETE FROM obra.usuario_proyecto
                WHERE id_proyecto = $1 AND id_usuario = $2
            `,
                                [proyecto, colaborador],
                            );

                            try {
                                await comprobarAccesoRaster(cookieColaborador, 404);

                                // Retirar al colaborador no afecta al propietario.
                                await comprobarAccesoRaster(cookiePropietario, 200);
                            } finally {
                                await database.query(
                                    `
                    INSERT INTO obra.usuario_proyecto (
                        id_usuario, id_proyecto
                    )
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `,
                                    [colaborador, proyecto],
                                );
                            }

                            await comprobarAccesoRaster(cookieColaborador, 200);
                        },
                    );

                    await t.test(
                        'raster: una cuenta colaboradora inactiva no puede reutilizar su cookie',
                        async () => {
                            await database.query(
                                `
                UPDATE obra.usuarios
                SET estado = 'INACTIVO'
                WHERE id_usuario = $1
            `,
                                [colaborador],
                            );

                            try {
                                await comprobarAccesoRaster(cookieColaborador, 401);
                                await comprobarAccesoRaster(cookiePropietario, 200);
                            } finally {
                                await database.query(
                                    `
                    UPDATE obra.usuarios
                    SET estado = 'ACTIVO'
                    WHERE id_usuario = $1
                `,
                                    [colaborador],
                                );
                            }
                        },
                    );

                    await t.test(
                        'raster: la inactivación del propietario también bloquea al colaborador',
                        async () => {
                            await database.query(
                                `
                UPDATE obra.usuarios
                SET estado = 'INACTIVO'
                WHERE id_usuario = $1
            `,
                                [propietario],
                            );

                            try {
                                await comprobarAccesoRaster(cookiePropietario, 401);

                                // Su cuenta está activa, pero el proyecto ya no está disponible.
                                await comprobarAccesoRaster(cookieColaborador, 404);
                            } finally {
                                await database.query(
                                    `
                    UPDATE obra.usuarios
                    SET estado = 'ACTIVO'
                    WHERE id_usuario = $1
                `,
                                    [propietario],
                                );
                            }
                        },
                    );

                    await t.test(
                        'raster: eliminar lógicamente el proyecto bloquea ambos recursos',
                        async () => {
                            await database.query(
                                `
                UPDATE obra.proyectos
                SET activo = false
                WHERE id_proyecto = $1
            `,
                                [proyecto],
                            );

                            try {
                                await comprobarAccesoRaster(cookiePropietario, 404);
                                await comprobarAccesoRaster(cookieColaborador, 404);

                                // La eliminación lógica conserva los archivos.
                                assert.deepEqual(
                                    await readFile(primeraTesela.ruta),
                                    pngEsperado,
                                );
                            } finally {
                                await database.query(
                                    `
                    UPDATE obra.proyectos
                    SET activo = true
                    WHERE id_proyecto = $1
                `,
                                    [proyecto],
                                );
                            }

                            await comprobarAccesoRaster(cookiePropietario, 200);
                            await comprobarAccesoRaster(cookieColaborador, 200);
                        },
                    );

                    await t.test(
                        'raster: no permite usar una capa bajo el identificador de otro proyecto',
                        async () => {
                            const otroProyecto = randomUUID();

                            await database.query(
                                `
                INSERT INTO obra.proyectos (
                    id_proyecto, id_propietario, nombre,
                    descripcion, direccion, contratante,
                    fecha_inicio, estado_proyecto
                )
                VALUES (
                    $1, $2, 'Proyecto aislado',
                    'Prueba de permisos', 'Dirección temporal',
                    'Contratante temporal', '2026-09-24', 'ACTIVA'
                )
            `,
                                [otroProyecto, propietario],
                            );

                            try {
                                /*
                                 * El usuario es propietario de ambos proyectos.
                                 * Aun así, la capa solamente pertenece al primero.
                                 */
                                for (const urlOriginal of [urlDescriptor, urlTesela]) {
                                    const urlAlterada = urlOriginal.replace(
                                        `/proyectos/${proyecto}/`,
                                        `/proyectos/${otroProyecto}/`,
                                    );

                                    assert.notEqual(urlAlterada, urlOriginal);

                                    const respuesta = await fetch(urlAlterada, {
                                        headers: { Cookie: cookiePropietario },
                                    });

                                    await respuesta.arrayBuffer();
                                    assert.equal(respuesta.status, 404);
                                }

                                await comprobarAccesoRaster(cookiePropietario, 200);
                            } finally {
                                await database.query(
                                    'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
                                    [otroProyecto],
                                );
                            }
                        },
                    );

                    // El respaldo original debe conservar exactamente sus bytes.
                    assert.deepEqual(
                        await readFile(
                            join(raizTemporal, ...publicada.original_key.split('/')),
                        ),
                        original,
                    );

                    assert.equal(await contarPublicaciones(), 1);

                    // El colaborador ya puede consultar los metadatos de la capa lista.
                    const consultaLista = await fetch(
                        `${baseUrl}/api/proyectos/${proyecto}/capas`,
                        { headers: { Cookie: cookieColaborador } },
                    );

                    assert.equal(consultaLista.status, 200);
                    assert.deepEqual((await consultaLista.json()).capas, [lista]);

                    // Una capa lista no debe procesarse nuevamente por esta operación.
                    await assert.rejects(
                        () => procesamiento.procesar(
                            proyecto,
                            capa.id_capa,
                            propietario,
                        ),
                        (error) => error.getStatus?.() === 409,
                    );

                    assert.deepEqual(
                        await readdir(carpetaCapa),
                        [publicada.teselas_version],
                    );
                    assert.equal(await contarPublicaciones(), 1);

                    /*
                     * Segunda capa: GDAL genera las teselas, pero PostgreSQL rechaza
                     * el historial final. Deben revertirse la publicación en BD
                     * y los archivos de esa versión, conservando el original.
                     */
                    const segunda = await subir(cookiePropietario);
                    assert.equal(
                        segunda.status,
                        201,
                        JSON.stringify(segunda.cuerpo),
                    );

                    const idSegunda = segunda.cuerpo.id_capa;
                    const segundaAntes = await consultarCapa(idSegunda);

                    const falloPublicacion = t.mock.method(
                        actividades,
                        'crear',
                        async (client, datos) => {
                            assert.equal(datos.tipoAccion, 'CAPA_PROCESADA');

                            // Provoca una violación NOT NULL real dentro de la transacción.
                            await client.query(
                                `
                    INSERT INTO obra.actividades (
                        id_proyecto, id_actor, tipo_accion, mensaje
                    )
                    VALUES ($1, $2, $3, NULL)
                `,
                                [datos.idProyecto, datos.idActor, datos.tipoAccion],
                            );
                        },
                    );

                    try {
                        await assert.rejects(
                            () => procesamiento.procesar(
                                proyecto,
                                idSegunda,
                                propietario,
                            ),
                            (error) => error.code === '23502',
                        );

                        assert.equal(falloPublicacion.mock.callCount(), 1);
                    } finally {
                        falloPublicacion.mock.restore();
                    }

                    const fallida = await consultarCapa(idSegunda);

                    assert.equal(fallida.estado_procesamiento, 'ERROR');
                    assert.equal(fallida.procesamiento_token, null);
                    assert.equal(fallida.procesamiento_inicio, null);
                    assert.equal(typeof fallida.error_procesamiento, 'string');
                    assert.ok(fallida.error_procesamiento.length > 0);

                    for (const campo of [
                        'teselas_version',
                        'teselas_proveedor',
                        'teselas_zoom_min',
                        'teselas_zoom_max',
                        'teselas_tamano',
                        'teselas_total',
                    ]) {
                        assert.equal(fallida[campo], null);
                    }

                    // Puede quedar la carpeta de la capa; ninguna versión fallida.
                    assert.deepEqual(
                        await readdir(
                            join(raizTemporal, 'capas-teselas', idSegunda),
                        ),
                        [],
                    );

                    assert.equal(fallida.original_key, segundaAntes.original_key);
                    assert.deepEqual(
                        await readFile(
                            join(raizTemporal, ...fallida.original_key.split('/')),
                        ),
                        original,
                    );

                    // El fallo no afecta a la primera capa ni añade historial de éxito.
                    assert.equal(await contarPublicaciones(), 1);
                    assert.deepEqual(
                        await consultarCapa(capa.id_capa),
                        publicada,
                    );
                    assert.deepEqual(
                        await readdir(carpetaCapa),
                        [publicada.teselas_version],
                    );

                    /* Insertar dentro de la prueba existente, antes del finally que restaura configuracionAnterior. */
                    async function solicitarReintento(cookie, id = idSegunda) {
                        const respuesta = await fetch(
                            `${baseUrl}/api/proyectos/${proyecto}/capas/${id}/reintentar`,
                            {
                                method: 'POST',
                                headers: { Origin: origen, ...(cookie ? { Cookie: cookie } : {}) },
                            },
                        );
                        return { status: respuesta.status, cuerpo: await respuesta.json() };
                    }

                    assert.equal((await solicitarReintento()).status, 401);
                    assert.equal((await solicitarReintento(cookieColaborador)).status, 404);
                    assert.equal((await solicitarReintento(cookiePropietario, randomUUID())).status, 404);
                    assert.equal((await solicitarReintento(cookiePropietario, capa.id_capa)).status, 409);
                    assert.deepEqual(await consultarCapa(idSegunda), fallida);

                    // Si falla el historial, ERROR debe conservarse mediante rollback real.
                    const falloReintento = t.mock.method(actividades, 'crear', async (client, datos) => {
                        assert.equal(datos.tipoAccion, 'CAPA_REINTENTO_SOLICITADO');
                        await client.query(
                            `INSERT INTO obra.actividades (id_proyecto, id_actor, tipo_accion, mensaje)
         VALUES ($1, $2, $3, NULL)`,
                            [datos.idProyecto, datos.idActor, datos.tipoAccion],
                        );
                    });
                    try {
                        assert.equal((await solicitarReintento(cookiePropietario)).status, 500);
                        assert.equal(falloReintento.mock.callCount(), 1);
                    } finally {
                        falloReintento.mock.restore();
                    }
                    assert.deepEqual(await consultarCapa(idSegunda), fallida);

                    // Dos solicitudes concurrentes: solo una puede aceptar la transición.
                    // El ayudante HTTP mantiene desactivado el trabajador automático.
                    const solicitudes = await Promise.all([
                        solicitarReintento(cookiePropietario),
                        solicitarReintento(cookiePropietario),
                    ]);
                    assert.deepEqual(solicitudes.map(r => r.status).sort((a, b) => a - b), [202, 409]);
                    assert.deepEqual(solicitudes.find(r => r.status === 202).cuerpo, {
                        id_capa: idSegunda, estado_procesamiento: 'PENDIENTE',
                    });

                    const pendienteOtraVez = await consultarCapa(idSegunda);
                    assert.equal(pendienteOtraVez.estado_procesamiento, 'PENDIENTE');
                    assert.equal(pendienteOtraVez.error_procesamiento, null);
                    assert.equal(pendienteOtraVez.procesamiento_token, null);
                    assert.equal(pendienteOtraVez.teselas_version, null);
                    for (const campo of ['original_key', 'tamano_original_bytes', 'nombre', 'opacidad', 'visible', 'orden']) {
                        assert.equal(pendienteOtraVez[campo], fallida[campo]);
                    }
                    const historialReintento = await database.query(
                        `SELECT id_actor FROM obra.actividades
     WHERE id_proyecto = $1 AND tipo_accion = 'CAPA_REINTENTO_SOLICITADO'`,
                        [proyecto],
                    );
                    assert.deepEqual(historialReintento.rows, [{ id_actor: propietario }]);

                    // Reutiliza realmente el original y ahora completa el procesamiento.
                    const recuperada = await procesamiento.procesar(proyecto, idSegunda, propietario);
                    assert.equal(recuperada.estado_procesamiento, 'LISTA');
                    assert.ok(recuperada.teselas);
                    assert.equal(await contarPublicaciones(), 2);
                    assert.deepEqual(
                        await readFile(join(raizTemporal, ...fallida.original_key.split('/'))),
                        original,
                    );
                    assert.equal((await solicitarReintento(cookiePropietario)).status, 409);

                    async function eliminarCapa(cookie) {
                        const respuesta = await fetch(
                            `${baseUrl}/api/proyectos/${proyecto}/capas/${idSegunda}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    Origin: origen,
                                    ...(cookie ? { Cookie: cookie } : {}),
                                },
                            },
                        );

                        await respuesta.arrayBuffer();
                        return respuesta.status;
                    }

                    assert.equal(await eliminarCapa(), 401);
                    assert.equal(await eliminarCapa(cookieColaborador), 404);

                    const antesDeEliminar = await consultarCapa(idSegunda);
                    assert.equal(antesDeEliminar.estado_procesamiento, 'LISTA');

                    assert.equal(await eliminarCapa(cookiePropietario), 204);

                    const eliminada = await database.query(
                        'SELECT id_capa FROM obra.capas WHERE id_capa = $1',
                        [idSegunda],
                    );
                    assert.equal(eliminada.rows.length, 0);

                    const tareaLimpieza = await database.query(
                        `
        SELECT original_key, teselas_version
        FROM obra.capas_pendientes_eliminacion
        WHERE id_capa = $1
    `,
                        [idSegunda],
                    );

                    assert.deepEqual(tareaLimpieza.rows, [{
                        original_key: antesDeEliminar.original_key,
                        teselas_version: antesDeEliminar.teselas_version,
                    }]);

                    // El acceso desaparece antes de ejecutar el borrado físico.
                    const descriptorEliminado = await fetch(
                        `${baseUrl}/api/proyectos/${proyecto}/capas/${idSegunda}`
                        + `/teselas/${antesDeEliminar.teselas_version}/tilejson.json`,
                        { headers: { Cookie: cookiePropietario } },
                    );

                    assert.equal(descriptorEliminado.status, 404);
                    await descriptorEliminado.arrayBuffer();

                    // El trabajador está desactivado en esta prueba: el original aún existe.
                    const rutaOriginalEliminado = join(
                        raizTemporal,
                        ...antesDeEliminar.original_key.split('/'),
                    );

                    assert.deepEqual(await readFile(rutaOriginalEliminado), original);

                    const limpieza = app.get(CapasLimpiezaService);

                    // El filtro limita la prueba exclusivamente a su propia tarea.
                    assert.equal(await limpieza.procesarSiguiente(idSegunda), true);
                    assert.equal(await limpieza.procesarSiguiente(idSegunda), false);

                    await assert.rejects(
                        readFile(rutaOriginalEliminado),
                        error => error.code === 'ENOENT',
                    );

                    await assert.rejects(
                        readdir(join(
                            raizTemporal,
                            'capas-teselas',
                            idSegunda,
                            antesDeEliminar.teselas_version,
                        )),
                        error => error.code === 'ENOENT',
                    );

                    const tareasRestantes = await database.query(
                        `
        SELECT id_capa
        FROM obra.capas_pendientes_eliminacion
        WHERE id_capa = $1
    `,
                        [idSegunda],
                    );
                    assert.equal(tareasRestantes.rows.length, 0);

                    // La primera capa y sus teselas permanecen intactas.
                    assert.deepEqual(await consultarCapa(capa.id_capa), publicada);

                    const primeraSigueDisponible = await fetch(urlTesela, {
                        headers: { Cookie: cookiePropietario },
                    });

                    assert.equal(primeraSigueDisponible.status, 200);
                    assert.deepEqual(
                        Buffer.from(await primeraSigueDisponible.arrayBuffer()),
                        pngEsperado,
                    );

                    assert.equal(await eliminarCapa(cookiePropietario), 404);

                } finally {
                    for (const [nombre, valor] of configuracionAnterior) {
                        if (valor === undefined) {
                            delete process.env[nombre];
                        } else {
                            process.env[nombre] = valor;
                        }
                    }
                }
            } finally {
                /*
                 * Limpia únicamente los registros generados por esta prueba.
                 * El ayudante elimina después su almacenamiento temporal.
                 */
                await database.withTransaction(async (client) => {
                    await client.query(
                        'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
                        [proyecto],
                    );
                    await client.query(
                        'DELETE FROM obra.usuarios WHERE id_usuario = ANY($1::uuid[])',
                        [[propietario, colaborador]],
                    );
                });
            }
        });
    } finally {
        if (limiteAnterior === undefined) {
            delete process.env.CAPAS_MAX_ARCHIVO_BYTES;
        } else {
            process.env.CAPAS_MAX_ARCHIVO_BYTES = limiteAnterior;
        }
    }
});