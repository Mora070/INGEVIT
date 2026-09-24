const { lstat, readFile } = require('node:fs/promises');
const path = require('node:path');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fechaValida(valor) {
  if (typeof valor !== 'string') return false;

  const fecha = new Date(valor);
  return Number.isFinite(fecha.getTime())
    && fecha.toISOString() === valor;
}

/**
 * Lee únicamente el registro de un directorio ya validado.
 *
 * Un registro válido identifica su procedencia; no acredita que
 * Node o sus procesos GIS hayan terminado.
 */
async function leerRegistroTemporal(directorio, tipoEsperado) {
  const ruta = path.join(directorio, 'temporal.json');
  let informacion;

  try {
    informacion = await lstat(ruta);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { estado: 'AUSENTE', datos: null };
    }
    throw error;
  }

  if (
    informacion.isSymbolicLink()
    || !informacion.isFile()
    || informacion.size > 8192
  ) {
    return { estado: 'INVALIDO', datos: null };
  }

  // Los errores de lectura se propagan: no se ocultan como JSON inválido.
  const texto = await readFile(ruta, 'utf8');
  let registro;

  try {
    registro = JSON.parse(texto);
  } catch {
    return { estado: 'INVALIDO', datos: null };
  }

  const ejecucion = registro?.ejecucion;

  if (
    registro?.version !== 1
    || typeof registro.idTemporal !== 'string'
    || !UUID.test(registro.idTemporal)
    || registro.tipo !== tipoEsperado
    || !['original', 'teselas'].includes(registro.tipo)
    || !fechaValida(registro.fechaCreacion)
    || typeof ejecucion?.id !== 'string'
    || !UUID.test(ejecucion.id)
    || !Number.isSafeInteger(ejecucion.pid)
    || ejecucion.pid <= 0
    || typeof ejecucion.equipo !== 'string'
    || ejecucion.equipo.length === 0
    || ejecucion.equipo.length > 255
    || !fechaValida(ejecucion.registroInicial)
    || ejecucion.registroInicial > registro.fechaCreacion
  ) {
    return { estado: 'INVALIDO', datos: null };
  }

  // Devuelve solo campos reconocidos.
  return {
    estado: 'VALIDO',
    datos: {
      version: 1,
      idTemporal: registro.idTemporal,
      tipo: registro.tipo,
      fechaCreacion: registro.fechaCreacion,
      ejecucion: {
        id: ejecucion.id,
        pid: ejecucion.pid,
        equipo: ejecucion.equipo,
        registroInicial: ejecucion.registroInicial,
      },
    },
  };
}

module.exports = { leerRegistroTemporal };