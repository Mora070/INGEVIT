import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { AlmacenamientoService } from '../almacenamiento/almacenamiento.service';
import { CapasEliminacionRepository } from './capas-eliminacion.repository';
import { eliminarVersionTeselas } from './utils/eliminar-version-teselas';

/**
 * Ejecuta una tarea persistente de limpieza.
 *
 * El borrado es idempotente: si la confirmación de PostgreSQL falla,
 * el siguiente intento admite que los archivos ya no existan.
 */
@Injectable()
export class CapasLimpiezaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly capas: CapasEliminacionRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async procesarSiguiente(idCapa: string | null = null): Promise<boolean> {
    let seleccionada: string | undefined;

    try {
      return await this.database.withTransaction(async client => {
        const tarea = await this.capas.bloquearTarea(client, idCapa);

        if (!tarea) return false;

        seleccionada = tarea.id_capa;

        if (await this.capas.conservaReferencias(client, tarea)) {
          throw new Error(
            'La limpieza está bloqueada porque la capa conserva referencias.',
          );
        }

        if (tarea.teselas_version !== null) {
          await eliminarVersionTeselas(
            tarea.id_capa,
            tarea.teselas_version,
          );
        }

        await this.almacenamiento.eliminar(tarea.original_key);
        await this.capas.completar(client, tarea.id_capa);

        return true;
      });
    } catch (error: unknown) {
      if (seleccionada !== undefined) {
        const capa = seleccionada;

        try {
          await this.database.withTransaction(client =>
            this.capas.aplazar(client, capa),
          );
        } catch (errorAplazamiento: unknown) {
          throw new AggregateError(
            [error, errorAplazamiento],
            'Falló la limpieza y no pudo confirmarse su aplazamiento.',
          );
        }
      }

      throw error;
    }
  }
}