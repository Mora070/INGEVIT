import {
  useState,
} from 'react';

import {
  cambiarPassword,
} from '../../api/password.api';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './ChangePasswordForm.module.css';

interface ChangePasswordFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export function ChangePasswordForm({
  onCancel,
  onSuccess,
}: ChangePasswordFormProps) {
  const [
    passwordActual,
    setPasswordActual,
  ] = useState('');

  const [
    passwordNueva,
    setPasswordNueva,
  ] = useState('');

  const [
    confirmarPassword,
    setConfirmarPassword,
  ] = useState('');

  const [
    enviando,
    setEnviando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  async function enviarFormulario(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviando) {
      return;
    }

    setError(null);

    if (!passwordActual) {
      setError(
        'Ingresa tu contraseña actual.',
      );

      return;
    }

    if (!passwordNueva) {
      setError(
        'Ingresa una nueva contraseña.',
      );

      return;
    }

    if (
      passwordNueva.length < 8 ||
      passwordNueva.length > 128
    ) {
      setError(
        'La nueva contraseña debe tener entre 8 y 128 caracteres.',
      );

      return;
    }

    if (
      passwordNueva !==
      confirmarPassword
    ) {
      setError(
        'La confirmación de la nueva contraseña no coincide.',
      );

      return;
    }

    if (
      passwordActual ===
      passwordNueva
    ) {
      setError(
        'La nueva contraseña debe ser diferente de la contraseña actual.',
      );

      return;
    }

    try {
      setEnviando(true);

      await cambiarPassword({
        password_actual:
          passwordActual,
        password_nueva:
          passwordNueva,
      });

      onSuccess();
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof
        ApiError
      ) {
        setError(
          errorDesconocido.message,
        );

        return;
      }

      setError(
        'No fue posible cambiar la contraseña. Inténtalo nuevamente.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={enviarFormulario}
      noValidate
    >
      <div className={styles.intro}>
        <p>
          Después de cambiar tu contraseña,
          la sesión actual se cerrará por
          seguridad.
        </p>
      </div>

      {error && (
        <div
          className={styles.errorMessage}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="password-actual">
          Contraseña actual
        </label>

        <input
          id="password-actual"
          type="password"
          value={passwordActual}
          onChange={(event) => {
            setPasswordActual(
              event.target.value,
            );
          }}
          autoComplete="current-password"
          disabled={enviando}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password-nueva">
          Nueva contraseña
        </label>

        <input
          id="password-nueva"
          type="password"
          value={passwordNueva}
          onChange={(event) => {
            setPasswordNueva(
              event.target.value,
            );
          }}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          disabled={enviando}
          required
        />

        <span className={styles.helpText}>
          Debe tener entre 8 y 128
          caracteres.
        </span>
      </div>

      <div className={styles.field}>
        <label htmlFor="confirmar-password">
          Confirmar nueva contraseña
        </label>

        <input
          id="confirmar-password"
          type="password"
          value={confirmarPassword}
          onChange={(event) => {
            setConfirmarPassword(
              event.target.value,
            );
          }}
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          disabled={enviando}
          required
        />
      </div>

      <div className={styles.actions}>
        <button
          className={styles.cancelButton}
          type="button"
          onClick={onCancel}
          disabled={enviando}
        >
          Cancelar
        </button>

        <button
          className={styles.submitButton}
          type="submit"
          disabled={enviando}
        >
          {enviando
            ? 'Guardando...'
            : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}