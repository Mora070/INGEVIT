import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service';
import {
  CREAR_TRANSPORTE_CORREO,
  crearTransporteCorreo,
} from './correo-transporte';

/**
 * Proporciona el servicio y la fábrica del transporte SMTP.
 *
 * La construcción del transporte no envía mensajes.
 * El envío ocurre únicamente al invocar CorreoService.enviar().
 */
@Module({
  providers: [
    {
      provide: CREAR_TRANSPORTE_CORREO,
      useValue: crearTransporteCorreo,
    },
    CorreoService,
  ],
  exports: [CorreoService],
})
export class CorreosModule {}