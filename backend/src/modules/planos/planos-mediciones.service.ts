import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProyectoAccesoRepository } from '../../common/repositories/proyecto-acceso.repository';
import { GuardarMedicionesDto } from './dto/guardar-mediciones.dto';
import { validarEstadoMediciones } from './mediciones-estado';

@Injectable()
export class PlanosMedicionesService {
  constructor(private readonly database: DatabaseService, private readonly acceso: ProyectoAccesoRepository) {}

  async consultar(proyecto: string, plano: string, pagina: number, usuario: string) {
    return this.operar(proyecto, plano, pagina, usuario);
  }

  async guardar(proyecto: string, plano: string, pagina: number, usuario: string, dto: GuardarMedicionesDto) {
    validarEstadoMediciones(dto.estado);
    return this.operar(proyecto, plano, pagina, usuario, dto);
  }

  private async operar(proyecto: string, plano: string, pagina: number, usuario: string, dto?: GuardarMedicionesDto) {
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 2147483647) throw new BadRequestException('Página inválida.');
    return this.database.withTransaction(async (client) => {
      // Mismo orden de bloqueos que las demás escrituras del proyecto.
      if (!await this.acceso.bloquearDisponible(client, proyecto, usuario)) throw new NotFoundException('Plano no disponible.');
      const disponible = await client.query<{numero_paginas: number}>(
        'SELECT numero_paginas FROM obra.planos WHERE id_proyecto = $1 AND id_plano = $2 FOR UPDATE', [proyecto, plano]);
      if (!disponible.rows[0]) throw new NotFoundException('Plano no disponible.');
      if (pagina > disponible.rows[0].numero_paginas) throw new BadRequestException('La página no existe en el plano.');
      const actual = await client.query<{version: number; estado: Record<string, unknown>}>(
        'SELECT version, estado FROM obra.plano_mediciones WHERE id_plano = $1 AND numero_pagina = $2', [plano, pagina]);
      const registro = actual.rows[0] ?? {version: 0, estado: {schema: 1, mediciones: [], calibracion: null, unidades: 'm', precision: 2}};
      if (!dto) return registro;
      if (dto.version !== registro.version) throw new ConflictException('Otro usuario modificó las mediciones. Descarga tu borrador y carga la versión compartida antes de continuar.');
      const resultado = await client.query<{version: number; estado: Record<string, unknown>}>(
        `INSERT INTO obra.plano_mediciones (id_plano, numero_pagina, version, estado, id_editor)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (id_plano, numero_pagina) DO UPDATE SET version = EXCLUDED.version,
          estado = EXCLUDED.estado, id_editor = EXCLUDED.id_editor, actualizado_en = now()
        RETURNING version, estado`, [plano, pagina, registro.version + 1, JSON.stringify(dto.estado), usuario]);
      // PostgreSQL entrega NOTIFY solamente después de COMMIT, en todas las instancias.
      await client.query(`SELECT pg_notify('proyecto_cambios', json_build_object(
        'id_usuario', destinatario.id_usuario, 'id_proyecto', $1::text, 'recurso', 'MEDICIONES')::text)
        FROM (SELECT id_propietario AS id_usuario FROM obra.proyectos WHERE id_proyecto = $1::uuid
          UNION SELECT id_usuario FROM obra.usuario_proyecto WHERE id_proyecto = $1::uuid) destinatario`, [proyecto]);
      return resultado.rows[0];
    });
  }
}
