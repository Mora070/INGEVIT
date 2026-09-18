import { GoogleLoginButton } from '../../components/GoogleLoginButton/GoogleLoginButton';
import LoginForm from '../../components/LoginForm/LoginForm';
import type { Usuario } from '../../types/usuario';

import logoIngevit from '../../../../assets/branding/ingevit-logo2.png';

import styles from './LoginPage.module.css';

interface LoginPageProps {
  onAutenticado: (
    usuario: Usuario,
  ) => void;

  onIrRegistro: () => void;
  onIrRecuperacion: () => void;
}

export function LoginPage({
  onAutenticado,
  onIrRegistro,
  onIrRecuperacion,
}: LoginPageProps) {
  return (
    <main className={styles.page}>
      <div
        className={styles.topography}
        aria-hidden="true"
      />

      <section
        className={styles.card}
        aria-labelledby="login-title"
      >
        <header className={styles.header}>
          <div
            className={styles.logoFrame}
          >
            <img
              className={styles.logo}
              src={logoIngevit}
              alt="INGEVIT"
            />
          </div>

          <h1
            className={styles.title}
            id="login-title"
          >
            Bienvenido
          </h1>

          <p
            className={
              styles.description
            }
          >
            Inicia sesión para continuar
            a tu espacio de trabajo.
          </p>
        </header>

        <LoginForm
          onAutenticado={
            onAutenticado
          }
        />

        <div
          className={styles.recovery}
        >
          <span>
            ¿Olvidaste tu contraseña?
          </span>

          <button
            className={
              styles.textButton
            }
            type="button"
            onClick={
              onIrRecuperacion
            }
          >
            Recuperarla
          </button>
        </div>

        <div
          className={styles.divider}
          aria-hidden="true"
        >
          <span />

          <p>O</p>

          <span />
        </div>

        <GoogleLoginButton
          onAutenticado={
            onAutenticado
          }
        />

        <div
          className={
            styles.registerPrompt
          }
        >
          <span>
            ¿No tienes una cuenta?
          </span>

          <button
            className={
              styles.registerButton
            }
            type="button"
            onClick={onIrRegistro}
          >
            Crear cuenta
          </button>
        </div>
      </section>
    </main>
  );
}