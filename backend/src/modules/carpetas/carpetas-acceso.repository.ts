import {
  Injectable,
} from '@nestjs/common';

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

/**
 * Reutiliza las reglas compartidas de acceso a proyectos.
 *
 * Permite trabajar con carpetas tanto al propietario
 * como a colaboradores activos con acceso al proyecto.
 */
@Injectable()
export class CarpetasAccesoRepository
  extends ProyectoAccesoRepository {}