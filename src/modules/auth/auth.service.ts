import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { UsuariosService } from '../usuarios/usuarios.service';
import { PasswordService } from './services/password.service';
import { toUsuarioResponse } from '../usuarios/mappers/usuario.mapper';
import type { UsuarioResponse } from '../usuarios/types/usuario.types';
import { TokenService } from './services/token.service';
import type { ResultadoAutenticacion } from './types/resultado-autenticacion.types';
import type { RegisterDto } from './dto/register.dto';

/**
 * Coordina la autenticación.
 *
 * UsuariosService proporciona los datos internos de la cuenta.
 * PasswordService ejecuta las operaciones criptográficas.
 *
 * Este servicio nunca devuelve el hash ni la identidad de Google.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private hashSimulado: string | undefined;

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) { }

  /**
   * Prepara un hash de comparación al iniciar el módulo.
   *
   * Si el correo no existe o la cuenta no tiene contraseña,
   * realizamos igualmente una verificación criptográfica.
   * Esto reduce diferencias evidentes de tiempo entre esos casos.
   *
   * Se genera una sola vez por instancia del servicio.
   * No corresponde a ningún usuario y no se guarda en PostgreSQL.
   */
  async onModuleInit(): Promise<void> {
    const secretoTemporal = randomBytes(32).toString('hex');

    this.hashSimulado =
      await this.passwordService.generarHash(secretoTemporal);
  }

  /**
   * Valida las credenciales tradicionales.
   *
   * Precondición: el controlador habrá validado la entrada con LoginDto.
   *
   * Devuelve el perfil seguro cuando:
   * - La cuenta existe.
   * - Tiene una contraseña almacenada.
   * - La contraseña coincide.
   * - La cuenta está ACTIVA.
   *
   * Todavía no crea una sesión ni emite tokens.
   */
  async validarCredenciales(
    correo: string,
    password: string,
  ): Promise<UsuarioResponse> {
    const hashSimulado = this.hashSimulado;

    if (hashSimulado === undefined) {
      throw new Error(
        'El servicio de autenticación no se ha inicializado.',
      );
    }

    const usuario =
      await this.usuariosService.buscarPorCorreoParaAutenticacion(
        correo,
      );

    const hashAlmacenado = usuario?.password_hash ?? null;

    // También verificamos cuando el usuario no existe o utiliza Google.
    // Nunca generamos un hash nuevo en cada intento de inicio de sesión.
    const passwordCorrecto = await this.passwordService.verificar(
      password,
      hashAlmacenado ?? hashSimulado,
    );

    if (
      usuario === null ||
      hashAlmacenado === null ||
      !passwordCorrecto ||
      usuario.estado !== 'ACTIVO'
    ) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos.',
      );
    }

    return toUsuarioResponse(usuario);
  }


  /**
 * Coordina el inicio de sesión mediante correo y contraseña.
 *
 * Primero valida las credenciales y el estado de la cuenta.
 * Solo después emite un token para el usuario autenticado.
 *
 * Si cualquier operación falla, el error se propaga y no se
 * devuelve un resultado de autenticación satisfactorio.
 *
 * La creación de la cookie pertenece al controlador HTTP.
 */
async iniciarSesion(
  correo: string,
  password: string,
): Promise<ResultadoAutenticacion> {
  const usuario = await this.validarCredenciales(
    correo,
    password,
  );

  // La identidad procede del usuario encontrado en PostgreSQL,
  // nunca de un identificador enviado libremente por el cliente.
  const tokenAcceso = await this.tokenService.emitirToken(
    usuario.id_usuario,
  );

  return {
    tokenAcceso,
    usuario,
  };
}

/**
 * Registra una cuenta mediante correo y contraseña.
 *
 * Precondición: el controlador validó la entrada con RegisterDto.
 *
 * Flujo:
 * 1. Genera el hash sin modificar la contraseña.
 * 2. Construye explícitamente los datos internos de creación.
 * 3. Solicita la inserción a UsuariosService.
 * 4. Devuelve únicamente el perfil permitido.
 *
 * No emite tokens ni establece cookies.
 */
async registrar(
  datos: RegisterDto,
): Promise<UsuarioResponse> {
  const passwordHash = await this.passwordService.generarHash(
    datos.password,
  );

  /**
   * No propagamos el DTO mediante "...datos".
   * Enumeramos los campos admitidos para evitar trasladar
   * propiedades inesperadas al repositorio.
   *
   * Los campos opcionales ausentes se almacenarán como NULL.
   */
  const usuario = await this.usuariosService.crearTradicional({
    correo: datos.correo,
    passwordHash,
    nombre: datos.nombre ?? null,
    apellidos: datos.apellidos ?? null,
    telefono: datos.telefono ?? null,
    ubicacion: datos.ubicacion ?? null,
  });

  return toUsuarioResponse(usuario);
}

}