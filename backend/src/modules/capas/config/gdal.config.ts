import { isAbsolute, normalize } from 'node:path';

export interface GdalConfig {
    ejecutableInfo: string;
    directorioDatosGdal: string;
    directorioDatosProj: string;
    timeoutInfoMs: number;
}

/**
 * Configuración interna para inspeccionar GeoTIFF.
 *
 * Las rutas pertenecen al servidor y nunca se reciben del formulario.
 * Esta función valida su formato; no ejecuta procesos ni comprueba
 * la existencia de los archivos.
 *
 * La ejecución utilizará argumentos separados y no utilizará una shell.
 */
export function getGdalConfig(
    env: NodeJS.ProcessEnv = process.env,
): GdalConfig {
    // Solo una variable ausente utiliza el valor predeterminado.
    // Un valor presente pero inválido debe rechazarse.
    const timeout = env.CAPAS_GDALINFO_TIMEOUT_MS === undefined
        ? '30000'
        : env.CAPAS_GDALINFO_TIMEOUT_MS;

    if (
        typeof timeout !== 'string'
        || timeout !== timeout.trim()
        || !/^[1-9][0-9]*$/.test(timeout)
    ) {
        throw new Error(
            'CAPAS_GDALINFO_TIMEOUT_MS debe ser un entero positivo.',
        );
    }

    const timeoutInfoMs = Number(timeout);

    // Rango técnico de los temporizadores de Node.
    if (
        !Number.isSafeInteger(timeoutInfoMs)
        || timeoutInfoMs > 2147483647
    ) {
        throw new Error(
            'CAPAS_GDALINFO_TIMEOUT_MS excede el rango técnico permitido.',
        );
    }

    return {
        ejecutableInfo: leerRuta(env, 'CAPAS_GDALINFO_PATH'),
        directorioDatosGdal: leerRuta(env, 'CAPAS_GDAL_DATA'),
        directorioDatosProj: leerRuta(env, 'CAPAS_PROJ_DATA'),
        timeoutInfoMs,
    };
}

function leerRuta(
    env: NodeJS.ProcessEnv,
    nombre: string,
): string {
    const valor = env[nombre];

    if (
        typeof valor !== 'string'
        || valor.length === 0
        || valor !== valor.trim()
        || /[\u0000\r\n]/.test(valor)
        || !isAbsolute(valor)
    ) {
        throw new Error(
            `${nombre} debe contener una ruta absoluta válida.`,
        );
    }

    return normalize(valor);
}