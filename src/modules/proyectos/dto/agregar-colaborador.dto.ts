import { IsUUID } from 'class-validator';

/**
 * Entrada para agregar una cuenta existente como colaboradora.
 *
 * id_usuario identifica al destinatario de la operación,
 * no al usuario que realiza la solicitud.
 *
 * El servicio comprobará:
 * - Que el solicitante sea el propietario del proyecto.
 * - Que el proyecto esté disponible.
 * - Que la cuenta destinataria exista.
 *
 * La clave compuesta de usuario_proyecto evita duplicados.
 */
export class AgregarColaboradorDto {
  @IsUUID('all', {
    message: 'El identificador del colaborador debe ser un UUID válido.',
  })
  id_usuario!: string;
}