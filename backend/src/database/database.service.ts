import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getDatabaseConfig } from './database.config';
import {
  ResultadoTransaccionDesconocidoError,
} from './errors/resultado-transaccion-desconocido.error';

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
  implements OnModuleInit, OnApplicationShutdown {
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
   * Para operaciones transaccionales, utilizar withTransaction.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }


  /**
   * Ejecuta una operación utilizando una sola conexión y transacción.
   *
   * Reglas para el consumidor:
   * - Ejecutar todas las consultas mediante el client recibido.
   * - Esperar las consultas con await.
   * - No administrar BEGIN, COMMIT, ROLLBACK o release manualmente.
   * - No utilizar DatabaseService.query dentro de la operación.
   * - No ignorar errores SQL para continuar como si la operación funcionara.
   *
   * Si la operación falla y la reversión se confirma, propaga el error original.
   * Si falla COMMIT o no puede confirmarse ROLLBACK, informa incertidumbre
   * mediante ResultadoTransaccionDesconocidoError y descarta la conexión.
   *
   * No realiza reintentos automáticos.
   */
  async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    let discardClient = false;
    let commitIntentado = false;

    try {
      await client.query('BEGIN');

      const result = await operation(client);

      /*
       * La marca se establece ANTES de enviar COMMIT.
       * Si se pierde la conexión, no podemos asumir que no se confirmó.
       */
      commitIntentado = true;

      const confirmacion = await client.query('COMMIT');

      /*
       * Una transacción abortada puede terminar con una respuesta ROLLBACK
       * al solicitar COMMIT. No debemos comunicar éxito en ese caso.
       */
      if (confirmacion.command !== 'COMMIT') {
        throw new Error(
          'PostgreSQL no confirmó la transacción con una respuesta COMMIT.',
        );
      }

      return result;
    } catch (error: unknown) {
      if (commitIntentado) {
        discardClient = true;

        /*
         * Un ROLLBACK posterior no demostraría qué ocurrió con COMMIT.
         * Descartamos la conexión y dejamos la resolución al coordinador.
         */
        this.logger.error(
          'No se pudo confirmar el resultado de COMMIT. Se descartará la conexión.',
        );

        throw new ResultadoTransaccionDesconocidoError(
          'COMMIT',
          error,
        );
      }

      try {
        const reversion = await client.query('ROLLBACK');

        if (reversion.command !== 'ROLLBACK') {
          throw new Error(
            'PostgreSQL no confirmó la reversión con una respuesta ROLLBACK.',
          );
        }
      } catch (errorReversion: unknown) {
        discardClient = true;

        this.logger.error(
          'No se pudo confirmar la reversión. Se descartará la conexión.',
        );

        throw new ResultadoTransaccionDesconocidoError(
          'ROLLBACK',
          error,
          errorReversion,
        );
      }

      // Conserva, por ejemplo, un NotFoundException o un error de integridad.
      throw error;
    } finally {
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