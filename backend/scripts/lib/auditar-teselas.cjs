const { lstat, readdir, realpath } = require('node:fs/promises');
const { join, relative } = require('node:path');

const {
    verificarTeselas,
} = require('../../dist/modules/capas/utils/verificar-teselas');

function esUuid(valor) {
    return typeof valor === 'string'
        && valor.length === 36
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);
}

async function directorioSeguro(ruta) {
    const info = await lstat(ruta);

    return info.isDirectory()
        && !info.isSymbolicLink()
        && relative(ruta, await realpath(ruta)) === '';
}

/**
 * Inspecciona las versiones locales sin modificar archivos ni PostgreSQL.
 *
 * Una versión sin referencia NO implica que sea seguro eliminarla:
 * puede proceder de un intento interrumpido o de una confirmación incierta.
 *
 * Para un informe estable, ejecutar sin escritores ni procesos GIS activos.
 */
async function auditarTeselas(raiz, capas, tareas) {
    const referencias = new Map();
    const pendientes = new Set();
    const capasExistentes = new Set(capas.map(capa => capa.id_capa));
    const procesando = new Set(
        capas
            .filter(capa => capa.estado_procesamiento === 'PROCESANDO')
            .map(capa => capa.id_capa),
    );

    for (const capa of capas) {
        if (
            capa.teselas_proveedor === 'LOCAL'
            && capa.teselas_version !== null
        ) {
            if (!esUuid(capa.id_capa) || !esUuid(capa.teselas_version)) {
                throw new Error('Referencia de teselas inválida.');
            }

            referencias.set(
                `${capa.id_capa}/${capa.teselas_version}`,
                capa,
            );
        }
    }

    for (const tarea of tareas) {
        if (!esUuid(tarea.id_capa)) {
            throw new Error('Identificador de limpieza inválido.');
        }

        if (tarea.teselas_version !== null) {
            if (!esUuid(tarea.teselas_version)) {
                throw new Error('Versión pendiente inválida.');
            }

            pendientes.add(
                `${tarea.id_capa}/${tarea.teselas_version}`,
            );
        }
    }

    const informe = {
        categoriaAusente: false,
        coleccionesEncontradas: 0,
        referenciadasVerificadas: [],
        referenciadasConProblemas: [],
        referenciasSinDirectorio: [],
        versionesSinReferencia: [],
        versionesDeIntentosActivos: [],
        pendientesSinDirectorio: [],
        pendientesTodaviaReferenciadas: [],
        tareasConCapaExistente: tareas
            .filter(tarea => capasExistentes.has(tarea.id_capa))
            .map(tarea => tarea.id_capa)
            .sort(),
        carpetasDeCapaVacias: [],
        entradasNoReconocidas: [],
        intentos: capas
            .filter(capa => capa.estado_procesamiento === 'PROCESANDO')
            .map(capa => ({
                id_capa: capa.id_capa,
                vence: capa.procesamiento_vence,
                vigenciaVencida: capa.vigencia_vencida,
            })),
    };

    const encontradas = new Set();
    const categoria = join(raiz, 'capas-teselas');

    let nombresCapas = [];

    try {
        if (!await directorioSeguro(categoria)) {
            throw new Error('El directorio de teselas no es seguro.');
        }

        nombresCapas = await readdir(categoria);
    } catch (error) {
        if (error.code === 'ENOENT') {
            informe.categoriaAusente = true;
        } else {
            throw error;
        }
    }

    for (const idCapa of nombresCapas.sort()) {
        const carpetaCapa = join(categoria, idCapa);

        if (
            !esUuid(idCapa)
            || !await directorioSeguro(carpetaCapa)
        ) {
            informe.entradasNoReconocidas.push(idCapa);
            continue;
        }

        const versiones = await readdir(carpetaCapa);

        if (versiones.length === 0) {
            informe.carpetasDeCapaVacias.push(idCapa);
        }

        for (const version of versiones.sort()) {
            const clave = `${idCapa}/${version}`;
            const carpetaVersion = join(carpetaCapa, version);

            if (
                !esUuid(version)
                || !await directorioSeguro(carpetaVersion)
            ) {
                informe.entradasNoReconocidas.push(clave);
                continue;
            }

            encontradas.add(clave);

            const referencia = referencias.get(clave);

            if (referencia) {
                try {
                    // Una colección publicada solo debe contener "tiles".
                    const contenido = await readdir(carpetaVersion);

                    if (
                        contenido.length !== 1
                        || contenido[0] !== 'tiles'
                    ) {
                        throw new Error('Estructura inesperada.');
                    }

                    const total = Number(referencia.teselas_total);

                    if (!Number.isSafeInteger(total) || total <= 0) {
                        throw new Error('Cantidad inválida.');
                    }

                    const verificadas = await verificarTeselas(
                        join(carpetaVersion, 'tiles'),
                        {
                            zoomMin: referencia.teselas_zoom_min,
                            zoomMax: referencia.teselas_zoom_max,
                            maxArchivos: total,
                        },
                    );

                    if (verificadas.length !== total) {
                        throw new Error('Cantidad diferente.');
                    }

                    informe.referenciadasVerificadas.push(clave);
                } catch {
                    informe.referenciadasConProblemas.push({
                        clave,
                        motivo:
                            'No coincide la estructura, cantidad o contenido PNG con la publicación.',
                    });
                }
            } else if (pendientes.has(clave)) {
                // Su eliminación ya está registrada.
            } else if (procesando.has(idCapa)) {
                // No tratar una salida en preparación como huérfana.
                informe.versionesDeIntentosActivos.push(clave);
            } else {
                informe.versionesSinReferencia.push(clave);
            }
        }
    }

    informe.coleccionesEncontradas = encontradas.size;

    informe.referenciasSinDirectorio = [...referencias.keys()]
        .filter(clave => !encontradas.has(clave))
        .sort();

    informe.pendientesSinDirectorio = [...pendientes]
        .filter(clave => !encontradas.has(clave))
        .sort();

    informe.pendientesTodaviaReferenciadas = [...pendientes]
        .filter(clave => referencias.has(clave))
        .sort();

    return informe;
}

module.exports = { auditarTeselas };