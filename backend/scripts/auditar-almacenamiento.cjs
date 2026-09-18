const { Pool } = require('pg');
const { lstat, readdir, realpath } = require('node:fs/promises');
const path = require('node:path');

const {
  getDatabaseConfig,
} = require('../dist/database/database.config');

const {
  validarClaveAlmacenamiento,
} = require('../dist/modules/almacenamiento/utils/validar-clave-almacenamiento');

const CATEGORIAS = ['fotografias', 'planos', 'panoramicas', 'avatares'];

/**
 * Auditoría de solo lectura.
 *
 * Incluye referencias de usuarios y proyectos inactivos.
 * No considera seguro borrar un archivo solo por no encontrar referencia.
 * Ejecutar sin escritores ni trabajadores para obtener un informe estable.
 */
async function main() {
  const configurada = process.env.STORAGE_LOCAL_ROOT;

  if (!configurada || !path.isAbsolute(configurada)) {
    throw new Error('STORAGE_LOCAL_ROOT debe ser una ruta absoluta.');
  }

  const informacionRaiz = await lstat(configurada);

  if (
    informacionRaiz.isSymbolicLink() ||
    !informacionRaiz.isDirectory()
  ) {
    throw new Error('La raíz debe ser un directorio sin enlace simbólico.');
  }

  const raiz = await realpath(configurada);
  const pool = new Pool(getDatabaseConfig());
  let client;

  try {
    client = await pool.connect();
    await client.query(
      'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );

    const referencias = await client.query(`
      SELECT clave
      FROM (
        SELECT s3_key AS clave FROM obra.fotografias
        UNION
        SELECT original_s3_key AS clave FROM obra.fotografias
        UNION
        SELECT s3_key AS clave FROM obra.planos
        UNION
        SELECT s3_key AS clave FROM obra.panoramicas
        UNION
        SELECT foto_perfil_key AS clave FROM obra.usuarios
      ) AS archivos
      WHERE clave IS NOT NULL
    `);

    const pendientes = await client.query(`
      SELECT s3_key AS clave
      FROM obra.archivos_pendientes_eliminacion
    `);

    await client.query('COMMIT');

    const referenciadas = new Set(
      referencias.rows.map((fila) => fila.clave),
    );
    const enCola = new Set(
      pendientes.rows.map((fila) => fila.clave),
    );

    const existentes = new Set();
    const sinReferencia = [];
    const entradasNoReconocidas = [];
    const categoriasAusentes = [];

    for (const categoria of CATEGORIAS) {
      const directorio = path.join(raiz, categoria);
      let informacion;

      try {
        informacion = await lstat(directorio);
      } catch (error) {
        if (error.code === 'ENOENT') {
          categoriasAusentes.push(categoria);
          continue;
        }
        throw error;
      }

      if (
        informacion.isSymbolicLink() ||
        !informacion.isDirectory() ||
        path.relative(directorio, await realpath(directorio)) !== ''
      ) {
        throw new Error(`Directorio no válido para ${categoria}.`);
      }

      for (const nombre of await readdir(directorio)) {
        const clave = `${categoria}/${nombre}`;
        const archivo = await lstat(path.join(directorio, nombre));

        // No sigue enlaces ni recorre subdirectorios desconocidos.
        if (!archivo.isFile() || archivo.isSymbolicLink()) {
          entradasNoReconocidas.push(clave);
          continue;
        }

        try {
          validarClaveAlmacenamiento(clave);
        } catch {
          entradasNoReconocidas.push(clave);
          continue;
        }

        existentes.add(clave);

        if (!referenciadas.has(clave) && !enCola.has(clave)) {
          sinReferencia.push({
            clave,
            bytes: archivo.size,
            ultimaModificacion: archivo.mtime.toISOString(),
          });
        }
      }
    }

    const referenciasSinArchivo = [...referenciadas]
      .filter((clave) => !existentes.has(clave))
      .sort();

    const pendientesTodaviaReferenciados = [...enCola]
      .filter((clave) => referenciadas.has(clave))
      .sort();

    const pendientesSinArchivo = [...enCola]
      .filter((clave) => !existentes.has(clave))
      .sort();

    console.log(JSON.stringify({
      modo: 'SOLO_LECTURA',
      resumen: {
        archivosReconocidos: existentes.size,
        clavesReferenciadas: referenciadas.size,
        clavesPendientes: enCola.size,
        archivosSinReferencia: sinReferencia.length,
        referenciasSinArchivo: referenciasSinArchivo.length,
      },
      categoriasAusentes,
      archivosSinReferencia: sinReferencia.sort(
        (a, b) => a.clave.localeCompare(b.clave),
      ),
      referenciasSinArchivo,
      pendientesTodaviaReferenciados,
      pendientesSinArchivo,
      entradasNoReconocidas: entradasNoReconocidas.sort(),
    }, null, 2));
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    'No se pudo completar la auditoría. Comprueba la configuración, PostgreSQL y los permisos de lectura.',
  );
  process.exitCode = 1;
});