import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { PoolClient ,QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConfig } from './database.config';

/**
 * Administra las conexiones de la aplicación con PostgreSQL.
 *
 * Responsabilidades:
 * - Mantener un pool compartido.
 * - Comprobar la conexión durante el arranque.
 * - Ejecutar consultas individuales parametrizadas.
 * - Cerrar las conexiones durante el apagado de NestJS.
 *
 * No contiene reglas de negocio ni comprueba permisos de usuarios.
 * Esas responsabilidades pertenecen a los módulos de la aplicación.
 */
@Injectable()
export class DatabaseService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool(getDatabaseConfig());

    /*
     * Las conexiones ociosas también pueden fallar, por ejemplo,
     * si PostgreSQL se detiene.
     *
     * pg retira automáticamente la conexión afectada del pool.
     * Registramos el evento sin imprimir credenciales ni consultas.
     */
    this.pool.on('error', () => {
      this.logger.error(
        'Se perdió una conexión ociosa con PostgreSQL.',
      );
    });
  }

  /**
   * NestJS ejecuta este método durante la inicialización del módulo.
   *
   * SELECT 1 comprueba que PostgreSQL acepta la conexión y responde.
   * No verifica todavía permisos sobre las tablas del esquema obra.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');

      this.logger.log('Conexión con PostgreSQL establecida.');
    } catch {
      await this.pool.end();

      throw new Error(
        'No se pudo conectar con PostgreSQL. Revisa el servicio, las variables DB_* y los permisos de conexión.',
      );
    }
  }

  /**
   * Ejecuta una consulta individual.
   *
   * Los datos externos deben enviarse mediante values y utilizar
   * marcadores $1, $2, etc. en el SQL; nunca concatenarlos al texto.
   *
   * El pool obtiene y libera la conexión automáticamente.
   *
   * No utilizar este método para repartir BEGIN, consultas y COMMIT:
   * una transacción necesita una misma conexión durante toda su ejecución.
   * Implementaremos ese mecanismo antes de escribir operaciones de negocio.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }


    /**
   * Ejecuta una operación dentro de una transacción.
   *
   * Confirma los cambios únicamente si toda la operación termina
   * correctamente. Si ocurre un error, intenta revertirlos.
   *
   * Reglas para quien utilice este método:
   * - Ejecutar todas las consultas mediante el client recibido.
   * - Esperar las consultas con await.
   * - No ejecutar BEGIN, COMMIT, ROLLBACK ni release manualmente.
   * - No usar DatabaseService.query() dentro de la operación:
   *   podría utilizar otra conexión y quedar fuera de la transacción.
   *
   * No realiza reintentos automáticos.
   */
  async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    // Si no se obtiene una conexión, el error se propaga.
    // En ese caso todavía no existe un cliente que debamos liberar.
    const client = await this.pool.connect();

    let discardClient = false;

    try {
      await client.query('BEGIN');

      const result = await operation(client);

      await client.query('COMMIT');

      return result;
    } catch (error: unknown) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /*
         * Si falla la reversión, no devolvemos esta conexión
         * al conjunto de conexiones reutilizables.
         *
         * Conservamos el error original para no ocultar
         * la causa que interrumpió la operación.
         */
        discardClient = true;

        this.logger.error(
          'Falló la reversión de una transacción. Se descartará la conexión.',
        );
      }

      throw error;
    } finally {
      // true destruye la conexión; false la devuelve al pool.
      client.release(discardClient);
    }
  }

  /**
   * Cierra el pool cuando NestJS apaga la aplicación.
   *
   * Para atender señales como Ctrl+C, habilitaremos los hooks
   * de apagado en main.ts al integrar el módulo.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();

    this.logger.log('Pool de PostgreSQL cerrado.');
  }
}