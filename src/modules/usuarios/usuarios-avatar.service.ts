import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import {
  ArchivosPendientesRepository,
} from '../almacenamiento/archivos-pendientes.repository';

import {
  UsuariosAvatarRepository,
} from './usuarios-avatar.repository';

import type {
  NuevoAvatar,
} from './usuarios-avatar.repository';

/**
 * Coordina las referencias del avatar y la limpieza del archivo anterior.
 *
 * No procesa imágenes ni escribe archivos.
 * Cuando recibe un avatar nuevo, su archivo ya debe estar guardado.
 *
 * El controlador nunca debe aceptar una clave o URL proporcionada
 * directamente por el cliente: ambas las genera el backend.
 */
@Injectable()
export class UsuariosAvatarService {
  constructor(
    private readonly database: DatabaseService,
    private readonly avatares: UsuariosAvatarRepository,
    private readonly pendientes: ArchivosPendientesRepository,
  ) {}

  /**
   * Sustituye el avatar o lo retira cuando recibe null.
   *
   * La actualización y la tarea de limpieza se confirman juntas.
   * Si alguna consulta falla, la transacción revierte ambos cambios.
   *
   * Cada sustitución requiere una clave nueva. Esto evita reutilizar
   * archivos antiguos que podrían estar pendientes de eliminación.
   */
  async cambiarReferencia(
    idUsuario: string,
    avatar: NuevoAvatar | null,
  ): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const actual = await this.avatares.bloquearCuentaActiva(
        client,
        idUsuario,
      );

      if (actual === null) {
        throw new UnauthorizedException(
          'La sesión no es válida o ha expirado.',
        );
      }

      if (
        avatar !== null &&
        avatar.clave === actual.foto_perfil_key
      ) {
        throw new Error(
          'El nuevo avatar debe utilizar una clave diferente.',
        );
      }

      // Retirar un avatar inexistente es una operación válida.
      if (
        avatar === null &&
        actual.foto_perfil_key === null
      ) {
        return;
      }

      await this.avatares.actualizarReferencia(
        client,
        idUsuario,
        avatar,
      );

      if (actual.foto_perfil_key !== null) {
        await this.pendientes.registrar(
          client,
          [actual.foto_perfil_key],
        );
      }
    });
  }
}