require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CapasProcesamientoService,
} = require('../dist/modules/capas/capas-procesamiento.service');
const {
    ResultadoTransaccionDesconocidoError,
} = require('../dist/database/errors/resultado-transaccion-desconocido.error');

const PROYECTO = '20000000-0000-4000-8000-000000000002';
const CAPA = '30000000-0000-4000-8000-000000000003';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const TOKEN = '40000000-0000-4000-8000-000000000004';
const VERSION = '50000000-0000-4000-8000-000000000005';

function escenario(opciones = {}) {
    let dentroDeTransaccion = false;
    let cierresError = 0;
    let ejecuciones = 0;
    let finalizaciones = 0;
    let actividades = 0;
    let comprobacionesProyecto = 0;

    const publicacion = {
        version: VERSION,
        proveedor: 'LOCAL',
        zoomMin: 12,
        zoomMax: 12,
        tamano: 256,
        total: '4',
    };

    const filaLista = {
        id_capa: CAPA,
        id_proyecto: PROYECTO,
        id_usuario_subida: USUARIO,
        nombre: 'Ortofoto',
        descripcion: '',
        nombre_archivo_original: 'original.tif',
        tamano_original_bytes: '2048',
        crs_original: 'WKT verificado',
        bbox_oeste: '-74.1',
        bbox_sur: '4.6',
        bbox_este: '-74',
        bbox_norte: '4.7',
        estado_procesamiento: 'LISTA',
        opacidad: '0.65',
        visible: false,
        orden: 2,
        teselas_version: VERSION,
        teselas_proveedor: 'LOCAL',
        teselas_zoom_min: 12,
        teselas_zoom_max: 12,
        teselas_tamano: 256,
        teselas_total: '4',
        fecha_creacion: new Date('2026-09-23T12:00:00Z'),
        fecha_actualizacion: new Date('2026-09-23T12:01:00Z'),
    };

    const servicio = new CapasProcesamientoService(
        {
            async withTransaction(operacion) {
                assert.equal(dentroDeTransaccion, false);
                dentroDeTransaccion = true;
                try {
                    return await operacion({ query: async () => ({ rows: [] }) });
                } finally {
                    dentroDeTransaccion = false;
                }
            },
        },
        {
            async bloquearPropietarioActivo() {
                assert.equal(dentroDeTransaccion, true);
                return true;
            },
            async bloquearEditablePorPropietario() {
                comprobacionesProyecto += 1;
                if (
                    opciones.perderPermiso
                    && comprobacionesProyecto === 2
                ) {
                    return null;
                }
                return {};
            },
        },
        {
            async iniciar() {
                return opciones.ocupada
                    ? null
                    : { id_capa: CAPA, procesamiento_token: TOKEN };
            },
            async renovar() { return opciones.vigencia !== false; },
            async finalizar(_client, proyecto, capa, token, datos) {
                finalizaciones += 1;
                assert.equal(dentroDeTransaccion, true);
                assert.deepEqual(
                    [proyecto, capa, token, datos],
                    [PROYECTO, CAPA, TOKEN, publicacion],
                );
                return filaLista;
            },
            async marcarError(_client, proyecto, capa, token) {
                cierresError += 1;
                assert.deepEqual(
                    [proyecto, capa, token],
                    [PROYECTO, CAPA, TOKEN],
                );
                return {};
            },
        },
        {
            async procesar(capa, registrar) {
                ejecuciones += 1;
                assert.equal(dentroDeTransaccion, false);
                assert.equal(capa.procesamiento_token, TOKEN);

                if (opciones.falloArchivos) {
                    throw opciones.falloArchivos;
                }

                return registrar(publicacion);
            },
        },
        {
            async crear(_client, datos) {
                actividades += 1;
                assert.equal(dentroDeTransaccion, true);
                assert.equal(datos.tipoAccion, 'CAPA_PROCESADA');
                assert.equal(datos.idActor, USUARIO);

                if (opciones.falloActividad) {
                    throw opciones.falloActividad;
                }
            },
        },
    );

    return {
        ejecutar: () => servicio.procesar(PROYECTO, CAPA, USUARIO),
        estado: () => ({
            cierresError,
            ejecuciones,
            finalizaciones,
            actividades,
            comprobacionesProyecto,
        }),
    };
}

test('procesamiento: genera fuera de la transacción y registra publicación e historial', async () => {
    const caso = escenario();
    const resultado = await caso.ejecutar();

    assert.equal(resultado.estado_procesamiento, 'LISTA');
    assert.equal(resultado.teselas.version, VERSION);
    assert.equal(resultado.opacidad, 0.65);
    assert.equal(resultado.visible, false);
    assert.equal(resultado.orden, 2);
    assert.equal(Object.hasOwn(resultado, 'procesamiento_token'), false);

    assert.deepEqual(caso.estado(), {
        cierresError: 0,
        ejecuciones: 1,
        finalizaciones: 1,
        actividades: 1,
        comprobacionesProyecto: 2,
    });
});

test('procesamiento: una capa ocupada no inicia trabajos de archivos', async () => {
    const caso = escenario({ ocupada: true });

    await assert.rejects(
        caso.ejecutar(),
        (error) => error.getStatus() === 409,
    );

    assert.equal(caso.estado().ejecuciones, 0);
    assert.equal(caso.estado().cierresError, 0);
});

test('procesamiento: registra el fallo de archivos sin intentar publicar', async () => {
    const fallo = new Error('GDAL falló');
    const caso = escenario({ falloArchivos: fallo });

    await assert.rejects(caso.ejecutar(), (error) => error === fallo);

    assert.equal(caso.estado().finalizaciones, 0);
    assert.equal(caso.estado().cierresError, 1);
});

test('procesamiento: un fallo de historial se propaga y cierra el intento', async () => {
    const fallo = new Error('Historial no disponible');
    const caso = escenario({ falloActividad: fallo });

    await assert.rejects(caso.ejecutar(), (error) => error === fallo);

    assert.equal(caso.estado().actividades, 1);
    assert.equal(caso.estado().cierresError, 1);
});

test('procesamiento: no altera el estado ante un resultado transaccional incierto', async () => {
    const fallo = new ResultadoTransaccionDesconocidoError(
        'COMMIT',
        new Error('Conexión interrumpida'),
    );
    const caso = escenario({ falloActividad: fallo });

    await assert.rejects(caso.ejecutar(), (error) => error === fallo);

    assert.equal(caso.estado().cierresError, 0);
});

test('procesamiento: vuelve a comprobar el permiso antes de confirmar', async () => {
    const caso = escenario({ perderPermiso: true });

    await assert.rejects(
        caso.ejecutar(),
        (error) => error.getStatus() === 404,
    );

    assert.equal(caso.estado().ejecuciones, 1);
    assert.equal(caso.estado().finalizaciones, 0);
    assert.equal(caso.estado().cierresError, 1);
});

test('procesamiento: no ejecuta archivos cuando el intento ya perdió vigencia', async () => {
    const caso = escenario({ vigencia: false });
    await assert.rejects(caso.ejecutar(), error => error.getStatus() === 409);
    assert.equal(caso.estado().ejecuciones, 0);
    assert.equal(caso.estado().cierresError, 1);
});
