import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Centraliza las operaciones criptográficas de las contraseñas.
 *
 * No consulta PostgreSQL, no valida el estado del usuario
 * y no crea sesiones. Esas tareas pertenecen a otros componentes.
 *
 * Nunca debe registrar contraseñas ni hashes en logs.
 */
@Injectable()
export class PasswordService {
  /**
   * Genera la representación que se guardará en password_hash.
   *
   * La biblioteca genera automáticamente una sal aleatoria.
   * El resultado incluye el algoritmo, sus parámetros, la sal
   * y el hash; no necesitamos columnas adicionales.
   *
   * La contraseña se utiliza exactamente como se recibe.
   */
  async generarHash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456, // KiB: equivale a 19 MiB.
      timeCost: 2,
      parallelism: 1,
      hashLength: 32, // Longitud del hash en bytes.
    });
  }

  /**
   * Comprueba una contraseña contra el hash obtenido del repositorio.
   *
   * Devuelve:
   * - true: la contraseña coincide.
   * - false: la contraseña no coincide.
   *
   * El hash debe proceder del almacenamiento interno,
   * nunca del cuerpo de una solicitud del cliente.
   *
   * Los errores técnicos se propagan: un hash corrupto o un fallo
   * de la biblioteca no debe confundirse con una contraseña incorrecta.
   */
  async verificar(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }
}