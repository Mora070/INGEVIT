import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  AlmacenamientoModule,
} from '../almacenamiento/almacenamiento.module';

import { UsuariosModule } from './usuarios.module';
import { UsuariosPerfilController } from './usuarios-perfil.controller';
import { UsuariosAvatarController } from './usuarios-avatar.controller';
import { UsuariosAvatarRepository } from './usuarios-avatar.repository';
import { UsuariosAvatarService } from './usuarios-avatar.service';
import {
  UsuariosAvatarArchivosService,
} from './usuarios-avatar-archivos.service';
import {
  UsuariosAvatarPersistenciaService,
} from './usuarios-avatar-persistencia.service';
import {
  UsuariosAvatarAccesoRepository,
} from './usuarios-avatar-acceso.repository';
import {
  UsuariosAvatarOperacionesService,
} from './usuarios-avatar-operaciones.service';

/**
 * Conecta las rutas de perfil y avatar con autenticación y almacenamiento.
 *
 * UsuariosService se reutiliza desde UsuariosModule.
 * Los servicios del avatar se registran únicamente en este módulo,
 * evitando una dependencia circular entre usuarios y autenticación.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsuariosModule,
    AlmacenamientoModule,
  ],
  controllers: [
    UsuariosPerfilController,
    UsuariosAvatarController,
  ],
  providers: [
    UsuariosAvatarRepository,
    UsuariosAvatarService,
    UsuariosAvatarArchivosService,
    UsuariosAvatarPersistenciaService,
    UsuariosAvatarAccesoRepository,
    UsuariosAvatarOperacionesService,
  ],
})
export class UsuariosPerfilModule {}