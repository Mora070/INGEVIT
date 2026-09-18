import { useState } from 'react';

import { ApiError } from '../../../../shared/api/http';
import { iniciarSesion } from '../../api/auth.api';
import type { Usuario } from '../../types/usuario';

import styles from './LoginForm.module.css';

interface LoginFormProps {
  onAutenticado: (usuario: Usuario) => void;
}

interface ErroresFormulario {
  correo?: string;
  password?: string;
}

export default function LoginForm({
  onAutenticado,
}: LoginFormProps) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [erroresFormulario, setErroresFormulario] =
    useState<ErroresFormulario>({});

  const [errorGeneral, setErrorGeneral] =
    useState<string | null>(null);

  const [enviando, setEnviando] =
    useState(false);

  function validarFormulario(): ErroresFormulario {
    const errores: ErroresFormulario = {};

    if (!correo.trim()) {
      errores.correo =
        'El correo electrónico es obligatorio.';
    }

    if (!password) {
      errores.password =
        'La contraseña es obligatoria.';
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

    if (Object.keys(errores).length > 0) {
      return;
    }

    setEnviando(true);

    try {
      const usuario = await iniciarSesion({
        correo: correo.trim(),
        password,
      });

      onAutenticado(usuario);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setErrorGeneral(
            'El correo o la contraseña son incorrectos.',
          );
        } else {
          setErrorGeneral(error.message);
        }
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
          htmlFor="login-correo"
        >
          Correo electrónico
        </label>

        <input
          className={styles.input}
          id="login-correo"
          name="correo"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          value={correo}
          onChange={(event) =>
            setCorreo(event.target.value)
          }
          aria-invalid={
            Boolean(erroresFormulario.correo)
          }
          aria-describedby={
            erroresFormulario.correo
              ? 'login-correo-error'
              : undefined
          }
          disabled={enviando}
          required
        />

        {erroresFormulario.correo && (
          <p
            className={styles.fieldError}
            id="login-correo-error"
            role="alert"
          >
            {erroresFormulario.correo}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="login-password"
        >
          Contraseña
        </label>

        <div className={styles.passwordWrapper}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="login-password"
            name="password"
            type={
              mostrarPassword
                ? 'text'
                : 'password'
            }
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            aria-invalid={
              Boolean(erroresFormulario.password)
            }
            aria-describedby={
              erroresFormulario.password
                ? 'login-password-error'
                : undefined
            }
            disabled={enviando}
            required
          />

          <button
            className={styles.togglePassword}
            type="button"
            onClick={() =>
              setMostrarPassword(
                (actual) => !actual,
              )
            }
            aria-label={
              mostrarPassword
                ? 'Ocultar contraseña'
                : 'Mostrar contraseña'
            }
            aria-pressed={mostrarPassword}
            disabled={enviando}
          >
            {mostrarPassword
              ? 'Ocultar'
              : 'Ver'}
          </button>
        </div>

        {erroresFormulario.password && (
          <p
            className={styles.fieldError}
            id="login-password-error"
            role="alert"
          >
            {erroresFormulario.password}
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

      <button
        className={styles.submitButton}
        type="submit"
        disabled={enviando}
      >
        {enviando
          ? 'Iniciando sesión...'
          : 'Iniciar sesión'}
      </button>
    </form>
  );
}