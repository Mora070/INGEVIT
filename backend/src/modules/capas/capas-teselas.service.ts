import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CapasTeselasRepository } from './capas-teselas.repository';
import { TeselasLocalesService } from './teselas-locales.service';

/** Autoriza cada petición antes de acceder al almacenamiento. */
@Injectable()
export class CapasTeselasService {
  constructor(
    private readonly repositorio: CapasTeselasRepository,
    private readonly archivos: TeselasLocalesService,
  ) {}

  async obtener(
    proyecto: string, capa: string, version: string, usuario: string,
    zoom: string, columna: string, nombre: string,
  ): Promise<Buffer> {
    const entero = (valor: string): number => {
      if (!/^(0|[1-9][0-9]*)$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
        throw new BadRequestException('Las coordenadas XYZ no son válidas.');
      }
      return Number(valor);
    };
    if (!/^(0|[1-9][0-9]*)\.png$/.test(nombre)) {
      throw new BadRequestException('El nombre de la tesela no es válido.');
    }
    const z = entero(zoom);
    const x = entero(columna);
    const y = entero(nombre.slice(0, -4));
    if (z > 30 || x >= 2 ** z || y >= 2 ** z) {
      throw new BadRequestException('Las coordenadas XYZ están fuera de rango.');
    }
    const disponible = await this.repositorio.buscarDisponible(proyecto, capa, version, usuario);
    if (!disponible || z < disponible.teselas_zoom_min || z > disponible.teselas_zoom_max) {
      throw new NotFoundException('La tesela no está disponible.');
    }
    // Las claves físicas proceden de la fila autorizada, no de una ruta enviada por el usuario.
    return this.archivos.leer(disponible.id_capa, disponible.teselas_version, z, x, y);
  }
}
