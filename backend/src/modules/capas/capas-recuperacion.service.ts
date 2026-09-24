import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CapasProcesamientoRepository } from './capas-procesamiento.repository';

/** Cierra permisos vencidos; nunca elimina archivos ni reencola automáticamente. */
@Injectable()
export class CapasRecuperacionService {
  private readonly logger = new Logger(CapasRecuperacionService.name);
  constructor(
    private readonly database: DatabaseService,
    private readonly procesamiento: CapasProcesamientoRepository,
  ) {}

  async recuperar(): Promise<number> {
    const recuperadas = await this.database.withTransaction(async client => {
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '5s'");
      return this.procesamiento.recuperarVencidos(client, 20);
    });
    if (recuperadas.length) {
      this.logger.warn(`Se cerraron ${recuperadas.length} intentos de capas con vigencia vencida.`);
    }
    return recuperadas.length;
  }
}
