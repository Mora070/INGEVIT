import { ValidationPipe } from '@nestjs/common';

/**
 * Construye la configuración compartida de validación de solicitudes.
 *
 * La aplicación y las pruebas deben utilizar esta función para evitar
 * diferencias entre lo que probamos y lo que ejecuta el servidor.
 *
 * Cada entrada debe declarar un DTO con decoradores de validación.
 * Esta configuración no sustituye la autenticación ni los permisos.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    /**
     * Convierte el objeto recibido en una instancia del DTO.
     * También permite ejecutar transformaciones explícitas,
     * como eliminar los espacios exteriores del correo.
     */
    transform: true,

    /**
     * Identifica como permitidas las propiedades que tienen
     * decoradores de validación en el DTO.
     */
    whitelist: true,

    /**
     * Rechaza propiedades adicionales en lugar de ignorarlas.
     * Por ejemplo, LoginDto no permite recibir "rol" o "estado".
     */
    forbidNonWhitelisted: true,

    /**
     * Rechaza objetos que no tienen metadatos de validación
     * cuando pasan por el proceso de validación.
     */
    forbidUnknownValues: true,

    /**
     * No convertir automáticamente números o booleanos en texto.
     * Los tipos incorrectos deben producir un error de validación.
     */
    transformOptions: {
      enableImplicitConversion: false,
    },

    /**
     * Evita incluir el objeto recibido y sus valores en los
     * errores de validación, especialmente las contraseñas.
     *
     * Esto no sustituye el control de datos sensibles en los logs.
     */
    validationError: {
      target: false,
      value: false,
    },
  });
}