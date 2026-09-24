const { lstat, readdir, realpath } = require('node:fs/promises');
const path = require('node:path');

const {
  leerRegistroTemporal,
} = require('./leer-registro-temporal.cjs');

/**
 * Inventario de solo lectura.
 *
 * Ejecutar sin subidas ni procesamientos para obtener datos estables.
 * No determina si un trabajo está activo ni autoriza eliminaciones.
 * Los bytes corresponden al tamaño lógico de los archivos.
 */
async function auditarTemporalesCapas(raizConfigurada) {
  if (!path.isAbsolute(raizConfigurada)) {
    throw new Error('La raíz temporal debe ser absoluta.');
  }

  const raiz = path.resolve(raizConfigurada);
  const informe = {
    raizAusente: false,
    directoriosReconocidos: 0,
    archivos: 0,
    bytes: '0',
    temporales: [],
    entradasNoReconocidas: [],
  };

  /*
   * Verifica todos los componentes antes de recorrer la raíz.
   * No crea la carpeta si todavía no existe.
   */
  const componentes = [];
  let actual = raiz;

  for (;;) {
    componentes.push(actual);
    const padre = path.dirname(actual);
    if (padre === actual) break;
    actual = padre;
  }

  for (const componente of componentes.reverse()) {
    let informacion;

    try {
      informacion = await lstat(componente);
    } catch (error) {
      if (error.code === 'ENOENT') {
        informe.raizAusente = true;
        return informe;
      }
      throw error;
    }

    if (
      informacion.isSymbolicLink()
      || !informacion.isDirectory()
      || path.relative(componente, await realpath(componente)) !== ''
    ) {
      throw new Error('La raíz temporal contiene un componente no válido.');
    }
  }

  let bytesTotales = 0n;

  async function recorrer(directorio, detalle, profundidad) {
    if (profundidad > 16) {
      throw new Error('El temporal supera la profundidad esperada.');
    }

    for (const nombre of (await readdir(directorio)).sort()) {
      const ruta = path.join(directorio, nombre);
      const informacion = await lstat(ruta, { bigint: true });
      const relativa = path.relative(raiz, ruta).split(path.sep).join('/');

      if (informacion.isSymbolicLink()) {
        detalle.conEntradasNoReconocidas = true;
        informe.entradasNoReconocidas.push(relativa);
        continue;
      }

      if (informacion.isDirectory()) {
        if (path.relative(ruta, await realpath(ruta)) !== '') {
          throw new Error('Cambió la ubicación de un directorio temporal.');
        }

        await recorrer(ruta, detalle, profundidad + 1);
      } else if (informacion.isFile()) {
        detalle.archivos += 1;
        detalle.bytes += informacion.size;
      } else {
        detalle.conEntradasNoReconocidas = true;
        informe.entradasNoReconocidas.push(relativa);
      }
    }
  }

  for (const nombre of (await readdir(raiz)).sort()) {
    const ruta = path.join(raiz, nombre);
    const informacion = await lstat(ruta);
    const coincidencia = /^(original|teselas)-[A-Za-z0-9]{6}$/.exec(nombre);

    if (
      !coincidencia
      || informacion.isSymbolicLink()
      || !informacion.isDirectory()
    ) {
      informe.entradasNoReconocidas.push(nombre);
      continue;
    }

    if (path.relative(ruta, await realpath(ruta)) !== '') {
      throw new Error('Cambió la ubicación de un temporal.');
    }

    const detalle = {
      directorio: nombre,
      tipo: coincidencia[1],
      registro: await leerRegistroTemporal(ruta, coincidencia[1]),
      archivos: 0,
      bytes: 0n,
      conEntradasNoReconocidas: false,
    };

    await recorrer(ruta, detalle, 0);

    informe.directoriosReconocidos += 1;
    informe.archivos += detalle.archivos;
    bytesTotales += detalle.bytes;

    informe.temporales.push({
      ...detalle,
      bytes: detalle.bytes.toString(),
    });
  }

  informe.bytes = bytesTotales.toString();
  informe.entradasNoReconocidas.sort();

  return informe;
}

module.exports = { auditarTemporalesCapas };