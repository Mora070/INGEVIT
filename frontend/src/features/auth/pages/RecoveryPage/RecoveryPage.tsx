import { useState } from 'react';

import { RecoveryRequestForm } from '../../components/RecoveryRequestForm/RecoveryRequestForm';
import { ResetPasswordForm } from '../../components/ResetPasswordForm/ResetPasswordForm';

import logoIngevit from '../../../../assets/branding/ingevit-logo2.png';

import styles from './RecoveryPage.module.css';

interface RecoveryPageProps {
  onVolverLogin: () => void;
}

type PasoRecuperacion =
  | {
      tipo: 'solicitud';
    }
  | {
      tipo: 'restablecer';
      correo: string;
      mensaje: string;
    }
  | {
      tipo: 'completado';
    };

export function RecoveryPage({
  onVolverLogin,
}: RecoveryPageProps) {
  const [paso, setPaso] =
    useState<PasoRecuperacion>({
      tipo: 'solicitud',
    });

  function manejarCodigoSolicitado(
    correo: string,
    mensaje: string,
  ) {
    setPaso({
      tipo: 'restablecer',
      correo,
      mensaje,
    });
  }

  function manejarRestablecida() {
    setPaso({
      tipo: 'completado',
    });
  }

  return (
    <main className={styles.page}>
      <div
        className={styles.topography}
        aria-hidden="true"
      />

      <section
        className={styles.card}
        aria-labelledby="recovery-title"
      >
        <header className={styles.header}>
          <div className={styles.logoFrame}>
            <img
              className={styles.logo}
              src={logoIngevit}
              alt="INGEVIT"
            />
          </div>

          {paso.tipo === 'solicitud' && (
            <>
              <h1
                className={styles.title}
                id="recovery-title"
              >
                Recuperar contraseña
              </h1>

              <p className={styles.description}>
                Ingresa tu correo electrónico y te enviaremos
                un código para continuar.
              </p>
            </>
          )}

          {paso.tipo === 'restablecer' && (
            <>
              <h1
                className={styles.title}
                id="recovery-title"
              >
                Restablecer contraseña
              </h1>

              <p className={styles.description}>
                Ingresa el código que recibiste y crea
                una nueva contraseña.
              </p>
            </>
          )}

          {paso.tipo === 'completado' && (
            <>
              <h1
                className={styles.title}
                id="recovery-title"
              >
                Contraseña actualizada
              </h1>

              <p className={styles.description}>
                Tu contraseña fue restablecida correctamente.
                Ya puedes iniciar sesión.
              </p>
            </>
          )}
        </header>

        {paso.tipo === 'solicitud' && (
          <RecoveryRequestForm
            onCodigoSolicitado={
              manejarCodigoSolicitado
            }
          />
        )}

        {paso.tipo === 'restablecer' && (
          <>
            <div
              className={styles.message}
              role="status"
            >
              {paso.mensaje}
            </div>

            <p className={styles.email}>
              Código enviado para:
              <strong>{paso.correo}</strong>
            </p>

            <ResetPasswordForm
              correo={paso.correo}
              onRestablecida={
                manejarRestablecida
              }
            />
          </>
        )}

        {paso.tipo === 'completado' && (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={onVolverLogin}
          >
            Volver a iniciar sesión
          </button>
        )}

        {paso.tipo !== 'completado' && (
          <div className={styles.backPrompt}>
            <span>
              ¿Recordaste tu contraseña?
            </span>

            <button
              className={styles.backButton}
              type="button"
              onClick={onVolverLogin}
            >
              Iniciar sesión
            </button>
          </div>
        )}
      </section>
    </main>
  );
}