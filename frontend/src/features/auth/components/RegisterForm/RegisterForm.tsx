import { useState } from 'react';

import { ApiError } from '../../../../shared/api/http';
import { registrarUsuario } from '../../api/auth.api';

import styles from './RegisterForm.module.css';

interface RegisterFormProps {
  onRegistroExitoso?: () => void;
}

interface ErroresFormulario {
  correo?: string;
  password?: string;
  confirmarPassword?: string;
}

export function RegisterForm({
  onRegistroExitoso,
}: RegisterFormProps) {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] =
    useState('');

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [mostrarConfirmacion, setMostrarConfirmacion] =
    useState(false);

  const [erroresFormulario, setErroresFormulario] =
    useState<ErroresFormulario>({});

  const [errorGeneral, setErrorGeneral] =
    useState<string | null>(null);

  const [registroExitoso, setRegistroExitoso] =
    useState(false);

  const [enviando, setEnviando] =
    useState(false);

  function validarFormulario(): ErroresFormulario {
    const errores: ErroresFormulario = {};

    if (!correo.trim()) {
      errores.correo = 'El correo es obligatorio.';
    }

    if (password.length < 8) {
      errores.password =
        'La contraseña debe tener al menos 8 caracteres.';
    } else if (password.length > 128) {
      errores.password =
        'La contraseña no puede superar los 128 caracteres.';
    }

    if (!confirmarPassword) {
      errores.confirmarPassword =
        'Debes confirmar la contraseña.';
    } else if (password !== confirmarPassword) {
      errores.confirmarPassword =
        'Las contraseñas no coinciden.';
    }

    return errores;
  }

  async function manejarSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviando) {
      return;
    }

    const errores = validarFormulario();

    setErroresFormulario(errores);
    setErrorGeneral(null);
    setRegistroExitoso(false);

    if (Object.keys(errores).length > 0) {
      return;
    }

    setEnviando(true);

    try {
      await registrarUsuario({
        correo: correo.trim(),
        password,
        nombre: nombre.trim() || undefined,
        apellidos: apellidos.trim() || undefined,
      });

      setRegistroExitoso(true);

      setNombre('');
      setApellidos('');
      setCorreo('');
      setPassword('');
      setConfirmarPassword('');

      onRegistroExitoso?.();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorGeneral(error.message);
      } else {
        setErrorGeneral(
          'No fue posible conectar con el servidor. Intenta nuevamente.',
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={manejarSubmit}
      noValidate
    >
      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="registro-nombre"
        >
          Nombre
        </label>

        <input
          className={styles.input}
          id="registro-nombre"
          name="nombre"
          type="text"
          autoComplete="given-name"
          placeholder="Ingresa tu nombre"
          value={nombre}
          onChange={(event) =>
            setNombre(event.target.value)
          }
          disabled={enviando}
        />
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="registro-apellidos"
        >
          Apellidos
        </label>

        <input
          className={styles.input}
          id="registro-apellidos"
          name="apellidos"
          type="text"
          autoComplete="family-name"
          placeholder="Ingresa tus apellidos"
          value={apellidos}
          onChange={(event) =>
            setApellidos(event.target.value)
          }
          disabled={enviando}
        />
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="registro-correo"
        >
          Correo electrónico
        </label>

        <input
          className={styles.input}
          id="registro-correo"
          name="correo"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={correo}
          onChange={(event) =>
            setCorreo(event.target.value)
          }
          aria-invalid={Boolean(
            erroresFormulario.correo,
          )}
          aria-describedby={
            erroresFormulario.correo
              ? 'registro-correo-error'
              : undefined
          }
          disabled={enviando}
          required
        />

        {erroresFormulario.correo && (
          <p
            className={styles.fieldError}
            id="registro-correo-error"
            role="alert"
          >
            {erroresFormulario.correo}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="registro-password"
        >
          Contraseña
        </label>

        <div className={styles.passwordWrapper}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="registro-password"
            name="password"
            type={mostrarPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Crea una contraseña"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            aria-invalid={Boolean(
              erroresFormulario.password,
            )}
            aria-describedby={
              erroresFormulario.password
                ? 'registro-password-error'
                : 'registro-password-ayuda'
            }
            disabled={enviando}
            required
          />

          <button
            className={styles.togglePassword}
            type="button"
            onClick={() =>
              setMostrarPassword((actual) => !actual)
            }
            aria-label={
              mostrarPassword
                ? 'Ocultar contraseña'
                : 'Mostrar contraseña'
            }
            aria-pressed={mostrarPassword}
            disabled={enviando}
          >
            {mostrarPassword ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        <p
          className={styles.helpText}
          id="registro-password-ayuda"
        >
          Debe tener entre 8 y 128 caracteres.
        </p>

        {erroresFormulario.password && (
          <p
            className={styles.fieldError}
            id="registro-password-error"
            role="alert"
          >
            {erroresFormulario.password}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="registro-confirmar-password"
        >
          Confirmar contraseña
        </label>

        <div className={styles.passwordWrapper}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="registro-confirmar-password"
            name="confirmarPassword"
            type={mostrarConfirmacion ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            value={confirmarPassword}
            onChange={(event) =>
              setConfirmarPassword(event.target.value)
            }
            aria-invalid={Boolean(
              erroresFormulario.confirmarPassword,
            )}
            aria-describedby={
              erroresFormulario.confirmarPassword
                ? 'registro-confirmar-password-error'
                : undefined
            }
            disabled={enviando}
            required
          />

          <button
            className={styles.togglePassword}
            type="button"
            onClick={() =>
              setMostrarConfirmacion((actual) => !actual)
            }
            aria-label={
              mostrarConfirmacion
                ? 'Ocultar confirmación de contraseña'
                : 'Mostrar confirmación de contraseña'
            }
            aria-pressed={mostrarConfirmacion}
            disabled={enviando}
          >
            {mostrarConfirmacion ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        {erroresFormulario.confirmarPassword && (
          <p
            className={styles.fieldError}
            id="registro-confirmar-password-error"
            role="alert"
          >
            {erroresFormulario.confirmarPassword}
          </p>
        )}
      </div>

      {errorGeneral && (
        <p
          className={styles.generalError}
          role="alert"
        >
          {errorGeneral}
        </p>
      )}

      {registroExitoso && (
        <p
          className={styles.success}
          role="status"
        >
          Cuenta creada correctamente. Ya puedes iniciar sesión.
        </p>
      )}

      <button
        className={styles.submitButton}
        type="submit"
        disabled={enviando}
      >
        {enviando
          ? 'Creando cuenta...'
          : 'Crear cuenta'}
      </button>
    </form>
  );
}