import { useState } from 'react';

import { ApiError } from '../../../../shared/api/http';
import {
  solicitarRecuperacionPassword,
} from '../../api/recuperacion.api';

import styles from './RecoveryRequestForm.module.css';

interface RecoveryRequestFormProps {
  onCodigoSolicitado: (
    correo: string,
    mensaje: string,
  ) => void;
}

export function RecoveryRequestForm({
  onCodigoSolicitado,
}: RecoveryRequestFormProps) {
  const [correo, setCorreo] = useState('');

  const [errorCorreo, setErrorCorreo] =
    useState<string | null>(null);

  const [errorGeneral, setErrorGeneral] =
    useState<string | null>(null);

  const [enviando, setEnviando] =
    useState(false);

  function validar(): boolean {
    const correoLimpio = correo.trim();

    if (!correoLimpio) {
      setErrorCorreo(
        'El correo electrónico es obligatorio.',
      );

      return false;
    }

    if (correoLimpio.length > 254) {
      setErrorCorreo(
        'El correo no puede superar 254 caracteres.',
      );

      return false;
    }

    setErrorCorreo(null);

    return true;
  }

  async function manejarSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviando) {
      return;
    }

    if (!validar()) {
      return;
    }

    const correoLimpio = correo.trim();

    setErrorGeneral(null);
    setEnviando(true);

    try {
      const respuesta =
        await solicitarRecuperacionPassword({
          correo: correoLimpio,
        });

      onCodigoSolicitado(
        correoLimpio,
        respuesta.message,
      );
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
          htmlFor="recuperacion-correo"
        >
          Correo electrónico
        </label>

        <input
          className={styles.input}
          id="recuperacion-correo"
          name="correo"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          maxLength={254}
          value={correo}
          onChange={(event) => {
            setCorreo(event.target.value);

            if (errorCorreo) {
              setErrorCorreo(null);
            }
          }}
          aria-invalid={Boolean(errorCorreo)}
          aria-describedby={
            errorCorreo
              ? 'recuperacion-correo-error'
              : undefined
          }
          disabled={enviando}
          required
        />

        {errorCorreo && (
          <p
            className={styles.fieldError}
            id="recuperacion-correo-error"
            role="alert"
          >
            {errorCorreo}
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
          ? 'Enviando código...'
          : 'Enviar código'}
      </button>
    </form>
  );
}