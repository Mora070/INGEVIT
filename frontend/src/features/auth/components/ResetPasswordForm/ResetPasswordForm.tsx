import { useState } from 'react';

import { ApiError } from '../../../../shared/api/http';
import {
  restablecerPassword,
} from '../../api/recuperacion.api';

import styles from './ResetPasswordForm.module.css';

interface ResetPasswordFormProps {
  correo: string;
  onRestablecida: () => void;
}

interface ErroresFormulario {
  codigo?: string;
  passwordNueva?: string;
  confirmarPassword?: string;
}

export function ResetPasswordForm({
  correo,
  onRestablecida,
}: ResetPasswordFormProps) {
  const [codigo, setCodigo] = useState('');
  const [passwordNueva, setPasswordNueva] =
    useState('');
  const [
    confirmarPassword,
    setConfirmarPassword,
  ] = useState('');

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  const [
    mostrarConfirmacion,
    setMostrarConfirmacion,
  ] = useState(false);

  const [
    erroresFormulario,
    setErroresFormulario,
  ] = useState<ErroresFormulario>({});

  const [
    errorGeneral,
    setErrorGeneral,
  ] = useState<string | null>(null);

  const [enviando, setEnviando] =
    useState(false);

  function validarFormulario(): ErroresFormulario {
    const errores: ErroresFormulario = {};

    if (!/^[0-9]{8}$/.test(codigo)) {
      errores.codigo =
        'El código debe contener exactamente ocho dígitos.';
    }

    if (passwordNueva.length < 8) {
      errores.passwordNueva =
        'La contraseña debe tener al menos 8 caracteres.';
    } else if (passwordNueva.length > 128) {
      errores.passwordNueva =
        'La contraseña no puede superar los 128 caracteres.';
    }

    if (!confirmarPassword) {
      errores.confirmarPassword =
        'Debes confirmar la contraseña.';
    } else if (
      passwordNueva !== confirmarPassword
    ) {
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

    if (Object.keys(errores).length > 0) {
      return;
    }

    setEnviando(true);

    try {
      await restablecerPassword({
        correo,
        codigo,
        password_nueva: passwordNueva,
      });

      onRestablecida();
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

  function actualizarCodigo(
    valor: string,
  ) {
    const soloDigitos =
      valor.replace(/\D/g, '').slice(0, 8);

    setCodigo(soloDigitos);
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
          htmlFor="recuperacion-codigo"
        >
          Código de recuperación
        </label>

        <input
          className={`${styles.input} ${styles.codeInput}`}
          id="recuperacion-codigo"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="00000000"
          maxLength={8}
          value={codigo}
          onChange={(event) =>
            actualizarCodigo(event.target.value)
          }
          aria-invalid={
            Boolean(erroresFormulario.codigo)
          }
          aria-describedby={
            erroresFormulario.codigo
              ? 'recuperacion-codigo-error'
              : undefined
          }
          disabled={enviando}
          required
        />

        {erroresFormulario.codigo && (
          <p
            className={styles.fieldError}
            id="recuperacion-codigo-error"
            role="alert"
          >
            {erroresFormulario.codigo}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="recuperacion-password"
        >
          Nueva contraseña
        </label>

        <div className={styles.passwordWrapper}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="recuperacion-password"
            name="passwordNueva"
            type={
              mostrarPassword
                ? 'text'
                : 'password'
            }
            autoComplete="new-password"
            placeholder="Crea una nueva contraseña"
            minLength={8}
            maxLength={128}
            value={passwordNueva}
            onChange={(event) =>
              setPasswordNueva(
                event.target.value,
              )
            }
            aria-invalid={
              Boolean(
                erroresFormulario.passwordNueva,
              )
            }
            aria-describedby={
              erroresFormulario.passwordNueva
                ? 'recuperacion-password-error'
                : 'recuperacion-password-ayuda'
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

        <p
          className={styles.helpText}
          id="recuperacion-password-ayuda"
        >
          Debe tener entre 8 y 128 caracteres.
        </p>

        {erroresFormulario.passwordNueva && (
          <p
            className={styles.fieldError}
            id="recuperacion-password-error"
            role="alert"
          >
            {erroresFormulario.passwordNueva}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label
          className={styles.label}
          htmlFor="recuperacion-confirmar-password"
        >
          Confirmar contraseña
        </label>

        <div className={styles.passwordWrapper}>
          <input
            className={`${styles.input} ${styles.passwordInput}`}
            id="recuperacion-confirmar-password"
            name="confirmarPassword"
            type={
              mostrarConfirmacion
                ? 'text'
                : 'password'
            }
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            value={confirmarPassword}
            onChange={(event) =>
              setConfirmarPassword(
                event.target.value,
              )
            }
            aria-invalid={
              Boolean(
                erroresFormulario.confirmarPassword,
              )
            }
            aria-describedby={
              erroresFormulario.confirmarPassword
                ? 'recuperacion-confirmar-error'
                : undefined
            }
            disabled={enviando}
            required
          />

          <button
            className={styles.togglePassword}
            type="button"
            onClick={() =>
              setMostrarConfirmacion(
                (actual) => !actual,
              )
            }
            aria-label={
              mostrarConfirmacion
                ? 'Ocultar confirmación de contraseña'
                : 'Mostrar confirmación de contraseña'
            }
            aria-pressed={mostrarConfirmacion}
            disabled={enviando}
          >
            {mostrarConfirmacion
              ? 'Ocultar'
              : 'Ver'}
          </button>
        </div>

        {erroresFormulario.confirmarPassword && (
          <p
            className={styles.fieldError}
            id="recuperacion-confirmar-error"
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

      <button
        className={styles.submitButton}
        type="submit"
        disabled={enviando}
      >
        {enviando
          ? 'Restableciendo...'
          : 'Restablecer contraseña'}
      </button>
    </form>
  );
}