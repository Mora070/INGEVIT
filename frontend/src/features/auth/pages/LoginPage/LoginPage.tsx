
import { GoogleLoginButton } from '../../components/GoogleLoginButton/GoogleLoginButton';
import LoginForm from '../../components/LoginForm/LoginForm';
import type { Usuario } from '../../types/usuario';

import logoIngevit from '../../../../assets/branding/ingevit-360.png';

import styles from './LoginPage.module.css';

interface LoginPageProps {
  onAutenticado: (usuario: Usuario) => void;
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
      <div className={styles.topography} aria-hidden="true" />

      <div className={styles.container}>
        <section
          className={styles.card}
          aria-labelledby="login-title"
        >
          <div className={styles.brand}>
            <img
              className={styles.logo}
              src={logoIngevit}
              alt="INGEVIT 360"
            />
          </div>

          <header className={styles.header}>
            <h1 className={styles.title} id="login-title">
              Iniciar sesión
            </h1>

            <p className={styles.description}>
              Ingresa con tu cuenta de INGEVIT.
            </p>
          </header>

          <div className={styles.formSection}>
            <LoginForm onAutenticado={onAutenticado} />

            <div className={styles.recovery}>
              <button
                className={styles.textButton}
                type="button"
                onClick={onIrRecuperacion}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          <div className={styles.socialSection}>
            <div className={styles.divider} aria-hidden="true">
              <span />
              <p>O</p>
              <span />
            </div>

            <GoogleLoginButton onAutenticado={onAutenticado} />

            <div className={styles.registerPrompt}>
              <span>¿No tienes una cuenta?</span>

              <button
                className={styles.registerButton}
                type="button"
                onClick={onIrRegistro}
              >
                Crear cuenta
              </button>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          © {new Date().getFullYear()} INGEVIT 360
        </footer>
      </div>
    </main>
  );
}
