import { Transform } from 'class-transformer';
import { IsDefined, IsNumber, Max, Min } from 'class-validator';

/**
 * Convierte coordenadas recibidas como campos multipart.
 *
 * Acepta números y representaciones decimales, incluida la notación
 * científica. No interpreta booleanos, arreglos, cadenas vacías,
 * valores hexadecimales ni texto parcialmente numérico.
 *
 * Las entradas inválidas se conservan para que la validación
 * las rechace; nunca se sustituyen por una ubicación predeterminada.
 */
function convertirCoordenada(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const texto = value.trim();

  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  if (!decimal.test(texto)) {
    return value;
  }

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : value;
}

/**
 * Ubicación geográfica obligatoria en grados WGS84.
 *
 * La proporciona el usuario al seleccionar un punto en el mapa.
 * No se obtiene del GPS/EXIF del archivo.
 *
 * Ambas coordenadas son obligatorias. El valor cero es válido.
 * Esta clase no representa las coordenadas X/Y de un plano.
 */
export class UbicacionGeograficaDto {
  @Transform(({ value }) => convertirCoordenada(value), {
    toClassOnly: true,
  })
  @IsDefined({ message: 'La latitud es obligatoria.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La latitud debe ser un número finito.' },
  )
  @Min(-90, { message: 'La latitud debe ser mayor o igual a -90.' })
  @Max(90, { message: 'La latitud debe ser menor o igual a 90.' })
  latitud!: number;

  @Transform(({ value }) => convertirCoordenada(value), {
    toClassOnly: true,
  })
  @IsDefined({ message: 'La longitud es obligatoria.' })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La longitud debe ser un número finito.' },
  )
  @Min(-180, { message: 'La longitud debe ser mayor o igual a -180.' })
  @Max(180, { message: 'La longitud debe ser menor o igual a 180.' })
  longitud!: number;
}