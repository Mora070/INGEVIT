import { Transform } from 'class-transformer';
import {
  IsInt,
  Max,
  Min,
} from 'class-validator';

/**
 * Convierte únicamente cadenas compuestas por dígitos.
 *
 * Los parámetros de consulta HTTP llegan como texto.
 * No usamos conversión implícita para evitar aceptar:
 * - Cadenas vacías como cero.
 * - Arreglos como números.
 * - Notación exponencial o valores decimales.
 *
 * Los valores no admitidos se conservan para que fallen
 * los decoradores de validación.
 */
function convertirEnteroDeConsulta(valor: unknown): unknown {
  if (typeof valor === 'string' && /^[0-9]+$/.test(valor)) {
    return Number(valor);
  }

  return valor;
}

/**
 * Parámetros del listado paginado.
 *
 * Los valores predeterminados se aplican cuando el parámetro
 * no está presente. Un valor vacío o null debe rechazarse.
 */
export class ListarProyectosQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    convertirEnteroDeConsulta(value),
  )
  @IsInt({ message: 'La página debe ser un número entero.' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1.' })
  @Max(2_147_483_647, {
    message: 'La página supera el máximo admitido.',
  })
  pagina: number = 1;

  @Transform(({ value }: { value: unknown }) =>
    convertirEnteroDeConsulta(value),
  )
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1.' })
  @Max(100, {
    message: 'El límite no puede superar 100 proyectos.',
  })
  limite: number = 20;
}