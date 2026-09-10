import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Convierte únicamente cadenas formadas por dígitos.
 *
 * Los demás valores se conservan para que la validación los rechace.
 * Evita aceptar cadenas vacías, espacios o notación exponencial
 * mediante conversiones numéricas implícitas.
 */
function convertirEnteroDeConsulta(valor: unknown): unknown {
  if (typeof valor === 'string' && /^\d+$/.test(valor)) {
    return Number(valor);
  }

  return valor;
}

/**
 * Parámetros de paginación para consultar fotografías.
 *
 * Los valores predeterminados se aplican cuando se omiten los parámetros.
 * La validación global rechaza propiedades adicionales no declaradas.
 */
export class ListarFotografiasQueryDto {
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