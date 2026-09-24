require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');

const {
    CapasPersistenciaService,
} = require('../dist/modules/capas/capas-persistencia.service');

const {
    ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

const PROYECTO = '20000000-0000-4000-8000-000000000002';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const CAPA = '30000000-0000-4000-8000-000000000003';

async function escenario(opciones, comprobar) {
    const raiz = await mkdtemp(join(tmpdir(), 'ingevit-capa-persistencia-'));
    const ruta = join(raiz, 'original.bin');
    const contenido = Buffer.from([0, 1, 2, 3, 254, 255]);

    const eventos = [];
    const eliminadas = [];
    const client = {};
    let claveGuardada;
    let datosInsertados;
    let actividad;

    await writeFile(ruta, contenido);

    const servicio = new CapasPersistenciaService(
        {
            async withTransaction(operacion) {
                eventos.push('transaccion');
                const resultado = await operacion(client);

                if (opciones.errorTransaccion) {
                    throw opciones.errorTransaccion;
                }

                eventos.push('confirmada');
                return resultado;
            },
        },
        {
            async guardar(clave, flujo) {
                eventos.push('guardar');
                claveGuardada = clave;

                const fragmentos = [];
                for await (const fragmento of flujo) {
                    fragmentos.push(fragmento);
                }

                assert.deepEqual(Buffer.concat(fragmentos), contenido);

                if (opciones.errorAlmacenamiento) {
                    throw opciones.errorAlmacenamiento;
                }
            },
            async eliminar(clave) {
                eliminadas.push(clave);
                if (opciones.errorLimpieza) {
                    throw opciones.errorLimpieza;
                }
            },
        },
        {
            async bloquearPropietarioActivo(conexion, usuario) {
                assert.equal(conexion, client);
                assert.equal(usuario, USUARIO);
                eventos.push('usuario');
                return opciones.activo !== false;
            },
            async bloquearEditablePorPropietario(conexion, proyecto, usuario) {
                assert.equal(conexion, client);
                assert.equal(proyecto, PROYECTO);
                assert.equal(usuario, USUARIO);
                eventos.push('proyecto');
                return opciones.acceso === false ? null : {};
            },
        },
        {
            async crearPendiente(conexion, datos) {
                assert.equal(conexion, client);
                eventos.push('capa');
                datosInsertados = datos;

                return {
                    id_capa: CAPA,
                    id_proyecto: PROYECTO,
                    id_usuario_subida: USUARIO,
                    nombre: datos.nombre,
                    descripcion: datos.descripcion,
                    nombre_archivo_original: datos.nombreArchivoOriginal,
                    tamano_original_bytes: String(datos.tamanoOriginalBytes),
                    crs_original: datos.crsOriginal,
                    bbox_oeste: String(datos.bbox[0]),
                    bbox_sur: String(datos.bbox[1]),
                    bbox_este: String(datos.bbox[2]),
                    bbox_norte: String(datos.bbox[3]),
                    estado_procesamiento: 'PENDIENTE',
                    opacidad: '1',
                    visible: true,
                    orden: 0,
                    teselas_version: null,
                    teselas_proveedor: null,
                    teselas_zoom_min: null,
                    teselas_zoom_max: null,
                    teselas_tamano: null,
                    teselas_total: null,
                    fecha_creacion: new Date('2026-09-23T12:00:00Z'),
                    fecha_actualizacion: new Date('2026-09-23T12:00:00Z'),
                };
            },
        },
        {
            async crear(conexion, datos) {
                assert.equal(conexion, client);
                eventos.push('actividad');
                actividad = datos;
                if (opciones.errorActividad) {
                    throw opciones.errorActividad;
                }
            },
        },
    );

    try {
        await comprobar({
            ejecutar: () => servicio.guardarYRegistrar(
                PROYECTO,
                USUARIO,
                { nombre: 'Ortofoto', descripcion: '' },
                {
                    rutaTemporal: ruta,
                    nombreOriginal: 'levantamiento.tiff',
                    tamanoBytes: contenido.length,
                    metadatos: {
                        ancho: 16,
                        alto: 8,
                        crsOriginal: 'WKT verificado',
                        bbox: [-74.1, 4.6, -74, 4.7],
                    },
                },
            ),
            eventos,
            eliminadas,
            obtenerClave: () => claveGuardada,
            obtenerDatos: () => datosInsertados,
            obtenerActividad: () => actividad,
        });
    } finally {
        await rm(raiz, { recursive: true, force: true });
    }
}

test('persistencia de capa: conserva los bytes y registra capa e historial antes de confirmar', async () => {
    await escenario({}, async (caso) => {
        const resultado = await caso.ejecutar();

        assert.deepEqual(caso.eventos, [
            'guardar', 'transaccion', 'usuario',
            'proyecto', 'capa', 'actividad', 'confirmada',
        ]);
        assert.match(
            caso.obtenerClave(),
            /^capas\/[0-9a-f-]{36}\.tif$/,
        );

        assert.deepEqual(caso.obtenerDatos(), {
            idProyecto: PROYECTO,
            idUsuarioSubida: USUARIO,
            nombre: 'Ortofoto',
            descripcion: '',
            nombreArchivoOriginal: 'levantamiento.tiff',
            originalKey: caso.obtenerClave(),
            tamanoOriginalBytes: 6,
            crsOriginal: 'WKT verificado',
            bbox: [-74.1, 4.6, -74, 4.7],
        });

        assert.deepEqual(caso.obtenerActividad(), {
            idProyecto: PROYECTO,
            idActor: USUARIO,
            tipoAccion: 'CAPA_CREADA',
            mensaje: `Capa ${CAPA} registrada para procesamiento.`,
        });

        assert.equal(resultado.estado_procesamiento, 'PENDIENTE');
        assert.equal(resultado.teselas, null);
        assert.equal(Object.hasOwn(resultado, 'original_key'), false);
        assert.deepEqual(caso.eliminadas, []);
    });
});

test('persistencia de capa: vuelve a comprobar permisos y compensa si se perdieron', async () => {
    for (const [opciones, estado] of [
        [{ activo: false }, 401],
        [{ acceso: false }, 404],
    ]) {
        await escenario(opciones, async (caso) => {
            await assert.rejects(caso.ejecutar(), (error) => {
                assert.equal(error.getStatus(), estado);
                return true;
            });

            assert.equal(caso.eventos.includes('capa'), false);
            assert.deepEqual(caso.eliminadas, [caso.obtenerClave()]);
        });
    }
});

test('persistencia de capa: compensa el original si falla el historial', async () => {
    const fallo = new Error('Historial no disponible');

    await escenario({ errorActividad: fallo }, async (caso) => {
        await assert.rejects(caso.ejecutar(), (error) => error === fallo);
        assert.equal(caso.eventos.includes('confirmada'), false);
        assert.deepEqual(caso.eliminadas, [caso.obtenerClave()]);
    });
});

test('persistencia de capa: conserva el original ante un resultado transaccional incierto', async () => {
    for (const etapa of ['COMMIT', 'ROLLBACK']) {
        const fallo = new ResultadoTransaccionDesconocidoError(
            etapa,
            new Error('Conexión interrumpida'),
        );

        await escenario({ errorTransaccion: fallo }, async (caso) => {
            await assert.rejects(caso.ejecutar(), (error) => error === fallo);
            assert.deepEqual(caso.eliminadas, []);
        });
    }
});

test('persistencia de capa: no abre transacción ni elimina claves cuando falla el almacenamiento', async () => {
    const fallo = new Error('No se pudo guardar');

    await escenario({ errorAlmacenamiento: fallo }, async (caso) => {
        await assert.rejects(caso.ejecutar(), (error) => error === fallo);
        assert.deepEqual(caso.eventos, ['guardar']);
        assert.deepEqual(caso.eliminadas, []);
    });
});

test('persistencia de capa: conserva ambos errores si también falla la compensación', async () => {
    const registro = new Error('Fallo del historial');
    const limpieza = new Error('Fallo de eliminación');

    await escenario({
        errorActividad: registro,
        errorLimpieza: limpieza,
    }, async (caso) => {
        await assert.rejects(caso.ejecutar(), (error) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [registro, limpieza]);
            return true;
        });
    });
});