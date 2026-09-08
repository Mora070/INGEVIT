import { Pool } from 'pg';
import { getDatabaseConfig } from '../database/database.config';

/**
 * Comprueba el acceso de lectura al modelo desde la cuenta del backend.
 *
 * Se ejecuta manualmente durante la preparación del entorno.
 * No modifica datos ni devuelve registros de las tablas.
 *
 * Cada consulta verifica también la existencia de columnas importantes
 * para detectar una instalación incompleta o una versión anterior.
 */
const checks = [
  {
    table: 'usuarios',
    sql: 'SELECT id_usuario FROM obra.usuarios LIMIT 0',
  },
  {
    table: 'proyectos',
    sql: `
      SELECT id_proyecto, latitud, longitud
      FROM obra.proyectos
      LIMIT 0
    `,
  },
  {
    table: 'usuario_proyecto',
    sql: `
      SELECT id_usuario, id_proyecto
      FROM obra.usuario_proyecto
      LIMIT 0
    `,
  },
  {
    table: 'fotografias',
    sql: 'SELECT id_fotografia FROM obra.fotografias LIMIT 0',
  },
  {
    table: 'planos',
    sql: 'SELECT id_plano FROM obra.planos LIMIT 0',
  },
  {
    table: 'panoramicas',
    sql: 'SELECT id_panoramica FROM obra.panoramicas LIMIT 0',
  },
  {
    table: 'incidencias',
    sql: `
      SELECT id_incidencia, numero_pagina
      FROM obra.incidencias
      LIMIT 0
    `,
  },
  {
    table: 'notificaciones',
    sql: `
      SELECT id_notificacion, estado_envio_correo
      FROM obra.notificaciones
      LIMIT 0
    `,
  },
  {
    table: 'actividades',
    sql: 'SELECT id_actividad FROM obra.actividades LIMIT 0',
  },
] as const;

/**
 * Utiliza un pool propio porque este comando se ejecuta
 * en un proceso independiente del servidor NestJS.
 */
async function checkDatabase(): Promise<void> {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error('Se perdió una conexión ociosa durante la comprobación.');
    process.exitCode = 1;
  });

  try {
    for (const check of checks) {
      try {
        await pool.query(check.sql);
        console.log(`OK: ${check.table}`);
      } catch {
        throw new Error(
          `Falló la comprobación de obra.${check.table}. ` +
            'Revisa su existencia, las columnas y los permisos de lectura.',
        );
      }
    }

    console.log('Comprobación de lectura completada.');
  } finally {
    // Se ejecuta tanto si las comprobaciones pasan como si ocurre un error.
    await pool.end();
  }
}

checkDatabase().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'No se pudo completar la comprobación.',
  );

  process.exitCode = 1;
});