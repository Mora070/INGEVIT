
import { RegisterForm } from '../../components/RegisterForm/RegisterForm';

import logoPrincipal from '../../../../assets/branding/ingevit-360-white.png';

import styles from './RegisterPage.module.css';

interface RegisterPageProps {
  onIrLogin: () => void;
}

export function RegisterPage({
  onIrLogin,
}: RegisterPageProps) {
  return (
    <main className={styles.page}>
      <div
        className={styles.topography}
        aria-hidden="true"
      />

      <section className={styles.shell}>
        {/* PANEL IZQUIERDO */}
        <div className={styles.brandPanel}>
          <div className={styles.brandContent}>
            <img
              className={styles.mainLogo}
              src={logoPrincipal}
              alt="INGEVIT 360"
            />

            <div className={styles.brandText}>
              <p className={styles.eyebrow}>
                Gestión de proyectos
              </p>

              <h1 className={styles.brandTitle}>
                Construye, documenta y controla tus proyectos.
              </h1>

              <p className={styles.brandDescription}>
                Centraliza la información de obra, fotografías,
                planos, incidencias y avances en un solo lugar.
              </p>
            </div>
          </div>

          <div
            className={styles.brandAccent}
            aria-hidden="true"
          />
        </div>

        {/* PANEL DERECHO */}
        <div className={styles.formPanel}>
          <div className={styles.formContainer}>
            <header className={styles.header}>
              <h2 className={styles.title}>
                Crea tu cuenta
              </h2>

              <p className={styles.description}>
                Registra tus datos para comenzar a utilizar
                la plataforma.
              </p>
            </header>

            <RegisterForm
              onRegistroExitoso={onIrLogin}
            />

            <div className={styles.loginPrompt}>
              <span>¿Ya tienes una cuenta?</span>

              <button
                className={styles.loginButton}
                type="button"
                onClick={onIrLogin}
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
