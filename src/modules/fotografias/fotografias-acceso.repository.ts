import { Injectable } from '@nestjs/common';

import {
  ProyectoAccesoRepository,
} from '../../common/repositories/proyecto-acceso.repository';

/**
 * Conserva el identificador utilizado por el módulo de fotografías.
 *
 * La implementación compartida permite mantener las mismas reglas
 * transaccionales de acceso en fotografías y planos.
 */
@Injectable()
export class FotografiasAccesoRepository
  extends ProyectoAccesoRepository {}