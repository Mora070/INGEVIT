import { IsNotEmpty, IsString } from 'class-validator';

import {
  UbicacionGeograficaDto,
} from '../../../common/dto/ubicacion-geografica.dto';

/**
 * Metadatos enviados junto al archivo.
 *
 * El backend establece autor, proyecto, URL, clave, MIME y fecha.
 * El formato real de la imagen se comprobará a partir de sus bytes.
 */
export class SubirPanoramicaDto extends UbicacionGeograficaDto {
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  titulo!: string;
}