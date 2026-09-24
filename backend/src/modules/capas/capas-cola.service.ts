import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CapasProcesamientoService } from './capas-procesamiento.service';

interface CapaPendiente {
  id_capa: string;
  id_proyecto: string;
  id_propietario: string;
}

/**
 * Selecciona una candidata sin mantener una transacción durante GDAL.
 *
 * La consulta no reserva la capa. CapasProcesamientoService realiza
 * la reserva mediante la transición atómica PENDIENTE -> PROCESANDO
 * y vuelve a comprobar los permisos.
 */
@Injectable()
export class CapasColaService {
  constructor(
    private readonly database: DatabaseService,
    private readonly procesamiento: CapasProcesamientoService,
  ) {}

  async procesarSiguiente(): Promise<boolean> {
    const resultado = await this.database.query<CapaPendiente>(
      `
        SELECT
          c.id_capa,
          c.id_proyecto,
          p.id_propietario
        FROM obra.capas AS c
        INNER JOIN obra.proyectos AS p
          ON p.id_proyecto = c.id_proyecto
        INNER JOIN obra.usuarios AS propietario
          ON propietario.id_usuario = p.id_propietario
        WHERE c.estado_procesamiento = 'PENDIENTE'
          AND c.teselas_version IS NULL
          AND c.almacenamiento_proveedor = 'LOCAL'
          AND p.activo = true
          AND propietario.estado = 'ACTIVO'
        ORDER BY c.fecha_creacion ASC, c.id_capa ASC
        LIMIT 1
      `,
    );

    const capa = resultado.rows[0];

    if (!capa) {
      return false;
    }

    /*
     * Otro proceso puede reservarla después de nuestra consulta.
     * El coordinador rechazará el segundo intento antes de ejecutar GDAL.
     * Los errores se propagan al trabajador, que espera antes de continuar.
     */
    await this.procesamiento.procesar(
      capa.id_proyecto,
      capa.id_capa,
      capa.id_propietario,
    );

    return true;
  }
}