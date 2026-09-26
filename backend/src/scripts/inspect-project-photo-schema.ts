import { Pool } from 'pg';
import { getDatabaseConfig } from '../database/database.config';

interface ColumnaRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
}

interface ForeignKeyRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  delete_rule: string;
  update_rule: string;
}

async function inspectSchema(): Promise<void> {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error(
      'Se perdió una conexión ociosa durante la inspección.',
    );

    process.exitCode = 1;
  });

  try {
    const columnas = await pool.query<ColumnaRow>(`
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable
      FROM information_schema.columns AS c
      WHERE
        c.table_schema = 'obra'
        AND c.table_name IN (
          'proyectos',
          'fotografias'
        )
      ORDER BY
        c.table_name,
        c.ordinal_position
    `);

    console.log(
      '\n=== COLUMNAS ===\n',
    );

    for (const columna of columnas.rows) {
      console.log(
        [
          columna.table_name,
          columna.column_name,
          columna.data_type,
          `udt=${columna.udt_name}`,
          `nullable=${columna.is_nullable}`,
        ].join(' | '),
      );
    }

    const clavesForaneas =
      await pool.query<ForeignKeyRow>(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints AS tc
        INNER JOIN information_schema.key_column_usage AS kcu
          ON
            tc.constraint_name = kcu.constraint_name
            AND tc.constraint_schema = kcu.constraint_schema
        INNER JOIN information_schema.constraint_column_usage AS ccu
          ON
            tc.constraint_name = ccu.constraint_name
            AND tc.constraint_schema = ccu.constraint_schema
        INNER JOIN information_schema.referential_constraints AS rc
          ON
            tc.constraint_name = rc.constraint_name
            AND tc.constraint_schema = rc.constraint_schema
        WHERE
          tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'obra'
          AND tc.table_name IN (
            'proyectos',
            'fotografias'
          )
        ORDER BY
          tc.table_name,
          tc.constraint_name,
          kcu.ordinal_position
      `);

    console.log(
      '\n=== CLAVES FORÁNEAS ===\n',
    );

    if (
      clavesForaneas.rows.length ===
      0
    ) {
      console.log(
        'No se encontraron claves foráneas.',
      );
    }

    for (
      const clave of
      clavesForaneas.rows
    ) {
      console.log(
        [
          clave.constraint_name,
          `${clave.table_name}.${clave.column_name}`,
          '->',
          `${clave.foreign_table_name}.${clave.foreign_column_name}`,
          `ON DELETE ${clave.delete_rule}`,
          `ON UPDATE ${clave.update_rule}`,
        ].join(' '),
      );
    }
  } finally {
    await pool.end();
  }
}

inspectSchema().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'No se pudo completar la inspección.',
    );

    process.exitCode = 1;
  },
);