import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Readable } from 'node:stream';

import {
  AlmacenamientoService,
} from '../almacenamiento/almacenamiento.service';

import { UsuariosService } from './usuarios.service';
import { UsuariosAvatarService } from './usuarios-avatar.service';
import {
  UsuariosAvatarPersistenciaService,
} from './usuarios-avatar-persistencia.service';
import {
  UsuariosAvatarAccesoRepository,
} from './usuarios-avatar-acceso.repository';
import { optimizarAvatar } from './utils/optimizar-avatar';

export interface AvatarResponse {
  foto_perfil_url: string | null;
}

/**
 * Casos de uso del avatar.
 *
 * La identidad de escritura procede exclusivamente de la sesión.
 * Solo se almacena la versión optimizada; el original queda en memoria
 * durante el procesamiento y nunca se envía al almacenamiento.
 */
@Injectable()
export class UsuariosAvatarOperacionesService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly referencias: UsuariosAvatarService,
    private readonly persistencia: UsuariosAvatarPersistenciaService,
    private readonly acceso: UsuariosAvatarAccesoRepository,
    private readonly almacenamiento: AlmacenamientoService,
  ) {}

  async subir(
    idUsuario: string,
    contenido: Buffer,
  ): Promise<AvatarResponse> {
    // Rechaza cuentas inactivas antes de procesar la imagen.
    await this.usuarios.obtenerMiPerfil(idUsuario);

    const optimizado = await optimizarAvatar(contenido);

    // URL estable del avatar actual, servida siempre con autorización.
    const url = `/api/usuarios/${idUsuario}/avatar`;

    await this.persistencia.guardarYRegistrar(
      optimizado,
      (clave) =>
        this.referencias.cambiarReferencia(idUsuario, {
          url,
          clave,
        }),
    );

    /*
     * cambiarReferencia vuelve a comprobar el estado de la cuenta.
     * La respuesta se construye después de confirmar la transacción,
     * fuera del callback utilizado para compensar errores.
     */
    return { foto_perfil_url: url };
  }

  async retirar(idUsuario: string): Promise<AvatarResponse> {
    await this.referencias.cambiarReferencia(idUsuario, null);

    // El frontend utiliza las iniciales cuando recibe null.
    return { foto_perfil_url: null };
  }

  async abrir(
    idUsuario: string,
    idSolicitante: string,
  ): Promise<Readable> {
    const clave = await this.acceso.buscarDisponible(
      idUsuario,
      idSolicitante,
    );

    if (clave === null) {
      throw new NotFoundException(
        'La fotografía de perfil no está disponible.',
      );
    }

    // La clave procede de la consulta autorizada, no de la URL recibida.
    return this.almacenamiento.abrirLectura(clave);
  }
}