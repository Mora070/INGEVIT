require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  ArchivosPendientesRepository,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.repository');

test(
  'pendientes: dos trabajadores reservan tareas distintas y rollback libera la reserva',
  async () => {
    const pool = new Pool({
      ...getDatabaseConfig(),
      max: 2,
    });

    pool.on('error', () => {
      // No imprimimos datos de conexión.
      process.exitCode = 1;
    });

    const repositorio = new ArchivosPendientesRepository();

    const claves = [
      `fotografias/${randomUUID()}.jpeg`,
      `fotografias/${randomUUID()}.webp`,
    ];

    let primero;
    let segundo;

    try {
      const existentes = await pool.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM obra.archivos_pendientes_eliminacion
          ) AS hay_pendientes
        `,
      );

      assert.equal(
        existentes.rows[0].hay_pendientes,
        false,
        'Esta prueba requiere una cola vacía. No elimina tareas existentes.',
      );

      primero = await pool.connect();
      segundo = await pool.connect();

      /*
       * Confirmamos las tareas para que ambas conexiones puedan verlas.
       * No existen archivos físicos asociados a estas claves.
       */
      await primero.query('BEGIN');
      await repositorio.registrar(primero, claves);
      await primero.query('COMMIT');

      await primero.query('BEGIN');
      await segundo.query('BEGIN');

      /*
       * Acotamos las esperas para que una regresión en SKIP LOCKED
       * produzca un error y no deje la prueba esperando indefinidamente.
       */
      await primero.query("SET LOCAL statement_timeout = '5s'");
      await segundo.query("SET LOCAL statement_timeout = '5s'");

      const tareaPrimero = await repositorio.bloquearSiguiente(primero);

      assert.ok(tareaPrimero);
      assert.ok(claves.includes(tareaPrimero.s3_key));

      const tareaSegundo = await repositorio.bloquearSiguiente(segundo);

      assert.ok(tareaSegundo);
      assert.ok(claves.includes(tareaSegundo.s3_key));
      assert.notEqual(
        tareaPrimero.s3_key,
        tareaSegundo.s3_key,
      );

      /*
       * Cada conexión conserva el bloqueo de su tarea.
       * Al revertir la primera, su tarea no desaparece:
       * únicamente se libera la reserva.
       */
      await primero.query('ROLLBACK');

      const tareaLiberada = await repositorio.bloquearSiguiente(segundo);

      /*
       * La segunda conexión también puede seleccionar su propia tarea.
       * Como bloquearSiguiente ordena siempre por fecha y clave,
       * la primera tarea global vuelve a ser la que liberamos.
       */
      assert.ok(tareaLiberada);
      assert.equal(
        tareaLiberada.s3_key,
        tareaPrimero.s3_key,
      );

      /*
       * Probamos la retirada de tareas únicamente en PostgreSQL.
       * En producción, el trabajador debe borrar cada archivo
       * antes de llamar a completar.
       */
      await repositorio.completar(segundo, tareaLiberada.s3_key);
      await repositorio.completar(segundo, tareaSegundo.s3_key);

      await segundo.query('COMMIT');

      const restantes = await primero.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [claves],
      );

      assert.equal(restantes.rowCount, 0);
    } finally {
      /*
       * Liberamos primero las conexiones y sus posibles bloqueos.
       * Descartarlas evita devolver una conexión con estado incierto.
       */
      try {
        if (primero) {
          try {
            await primero.query('ROLLBACK');
          } finally {
            primero.release(true);
          }
        }
      } finally {
        try {
          if (segundo) {
            try {
              await segundo.query('ROLLBACK');
            } finally {
              segundo.release(true);
            }
          }
        } finally {
          try {
            // Solo limpiamos las claves generadas por esta prueba.
            await pool.query(
              `
                DELETE FROM obra.archivos_pendientes_eliminacion
                WHERE s3_key = ANY($1::text[])
              `,
              [claves],
            );
          } finally {
            await pool.end();
          }
        }
      }
    }
  },
);