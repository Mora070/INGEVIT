import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Convierte únicamente cadenas formadas por dígitos.
 *
 * Evita conversiones implícitas como interpretar un texto vacío
 * como cero o aceptar notación exponencial.
 *
 * Los demás valores permanecen sin cambios para que los validadores
 * puedan rechazarlos cuando corresponda.
 */
function convertirEnteroDeConsulta(valor: unknown): unknown {
  if (typeof valor === 'string' && /^\d+$/.test(valor)) {
    return Number(valor);
  }

  return valor;
}

/**
 * Parámetros de paginación del historial de actividades.
 *
 * Los valores predeterminados se aplican cuando el parámetro se omite.
 * La validación global rechaza parámetros adicionales no declarados.
 */
export class ListarActividadesQueryDto {
  @Transform(({ value }) => convertirEnteroDeConsulta(value))
  @IsInt({
    message: 'La página debe ser un número entero.',
  })
  @Min(1, {
    message: 'La página debe ser mayor o igual a 1.',
  })
  @Max(2147483647, {
    message: 'La página no puede superar 2147483647.',
  })
  pagina: number = 1;

  @Transform(({ value }) => convertirEnteroDeConsulta(value))
  @IsInt({
    message: 'El límite debe ser un número entero.',
  })
  @Min(1, {
    message: 'El límite debe ser mayor o igual a 1.',
  })
  @Max(100, {
    message: 'El límite no puede superar 100.',
  })
  limite: number = 20;
}