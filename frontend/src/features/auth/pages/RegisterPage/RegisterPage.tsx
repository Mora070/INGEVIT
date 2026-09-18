import { RegisterForm } from '../../components/RegisterForm/RegisterForm';

import logoPrincipal from '../../../../assets/branding/ingevit-logo.png';
import logoFormulario from '../../../../assets/branding/ingevit-logo2.png';

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
        <div className={styles.brandPanel}>
          <div className={styles.brandContent}>
            <img
              className={styles.mainLogo}
              src={logoPrincipal}
              alt="INGEVIT - Ingeniería, vías y topografía"
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

        <div className={styles.formPanel}>
          <div className={styles.formContainer}>
            <header className={styles.header}>
              <img
                className={styles.formLogo}
                src={logoFormulario}
                alt="INGEVIT"
              />

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