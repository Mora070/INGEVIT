import type { ReactNode } from 'react';

import type { Usuario } from '../../../auth/types/usuario';

import logoIngevit from '../../../../assets/branding/ingevit-logo2.png';

import styles from './AppShell.module.css';

export type SeccionWorkspace =
  | 'inicio'
  | 'proyectos'
  | 'perfil';

interface AppShellProps {
  usuario: Usuario;
  seccionActiva: SeccionWorkspace;

  children: ReactNode;

  onIrInicio: () => void;
  onIrProyectos: () => void;
  onIrPerfil: () => void;
  onCerrarSesion: () => void;

  cerrandoSesion?: boolean;
}

function obtenerIniciales(
  usuario: Usuario,
): string {
  const nombre =
    usuario.nombre?.trim() ?? '';

  const apellidos =
    usuario.apellidos?.trim() ?? '';

  if (nombre || apellidos) {
    const primera =
      nombre.charAt(0);

    const segunda =
      apellidos.charAt(0);

    return `${primera}${segunda}`
      .toUpperCase()
      .slice(0, 2);
  }

  return usuario.correo
    .slice(0, 2)
    .toUpperCase();
}

function obtenerNombreVisible(
  usuario: Usuario,
): string {
  const partes = [
    usuario.nombre?.trim(),
    usuario.apellidos?.trim(),
  ].filter(
    (valor): valor is string =>
      Boolean(valor),
  );

  if (partes.length > 0) {
    return partes.join(' ');
  }

  return usuario.correo;
}

export function AppShell({
  usuario,
  seccionActiva,
  children,
  onIrInicio,
  onIrProyectos,
  onIrPerfil,
  onCerrarSesion,
  cerrandoSesion = false,
}: AppShellProps) {
  const nombreVisible =
    obtenerNombreVisible(usuario);

  const iniciales =
    obtenerIniciales(usuario);

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img
            className={styles.brandLogo}
            src={logoIngevit}
            alt="INGEVIT"
          />
        </div>

        <div className={styles.userArea}>
          <button
            className={styles.notificationButton}
            type="button"
            aria-label="Notificaciones"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
              />
            </svg>

            <span
              className={styles.notificationDot}
              aria-hidden="true"
            />
          </button>

          <div className={styles.avatar}>
            {iniciales}
          </div>

          <div className={styles.userInfo}>
            <strong>
              {nombreVisible}
            </strong>

            <span>
              {usuario.rol ===
              'ADMINISTRADOR'
                ? 'Administrador'
                : 'Usuario'}
            </span>
          </div>

          <button
            className={styles.userMenuButton}
            type="button"
            aria-label="Abrir menú de usuario"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav
          className={styles.navigation}
          aria-label="Navegación principal"
        >
          <button
            className={`${styles.navItem} ${
              seccionActiva === 'inicio'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={onIrInicio}
            aria-current={
              seccionActiva === 'inicio'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10.5V20h13v-9.5" />
              <path d="M9.5 20v-6h5v6" />
            </svg>

            <span>
              Inicio
            </span>
          </button>

          <button
            className={`${styles.navItem} ${
              seccionActiva === 'proyectos'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={onIrProyectos}
            aria-current={
              seccionActiva === 'proyectos'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 7.5h6l2-2h10v14H3z" />
              <path d="M3 10h18" />
            </svg>

            <span>
              Proyectos
            </span>
          </button>

          <button
            className={`${styles.navItem} ${
              seccionActiva === 'perfil'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={onIrPerfil}
            aria-current={
              seccionActiva === 'perfil'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="8"
                r="4"
              />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>

            <span>
              Mi Perfil
            </span>
          </button>
        </nav>

        <div className={styles.sidebarBottom}>
          <button
            className={styles.supportButton}
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />
              <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.82C12.8 11.55 12 12.2 12 14" />
              <path d="M12 18h.01" />
            </svg>

            <span>
              Soporte
            </span>
          </button>

          <button
            className={styles.logoutButton}
            type="button"
            onClick={onCerrarSesion}
            disabled={cerrandoSesion}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M14 4h6v16h-6" />
            </svg>

            <span>
              {cerrandoSesion
                ? 'Cerrando...'
                : 'Cerrar sesión'}
            </span>
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}