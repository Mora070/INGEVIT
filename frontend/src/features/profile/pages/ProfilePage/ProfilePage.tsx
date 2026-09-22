import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  Usuario,
} from '../../../auth/types/usuario';

import { ChangePasswordForm } from '../../components/ChangePasswordForm/ChangePasswordForm';
import { ProfileAvatarEditor } from '../../components/ProfileAvatarEditor/ProfileAvatarEditor';
import { ProfileEditForm } from '../../components/ProfileEditForm/ProfileEditForm';

import styles from './ProfilePage.module.css';

interface ProfilePageProps {
  usuario: Usuario;
  onUsuarioActualizado: (usuario: Usuario) => void;
}

type TipoMensajeExito =
  | 'perfil'
  | 'password'
  | 'avatar'
  | 'avatar-eliminado'
  | null;

function obtenerIniciales(
  usuario: Usuario,
): string {
  const nombre =
    usuario.nombre?.trim() ?? '';

  const apellidos =
    usuario.apellidos?.trim() ?? '';

  if (nombre || apellidos) {
    return `${nombre.charAt(0)}${apellidos.charAt(0)}`
      .toUpperCase()
      .slice(0, 2);
  }

  return usuario.correo
    .slice(0, 2)
    .toUpperCase();
}

function obtenerNombreCompleto(
  usuario: Usuario,
): string {
  const partes = [
    usuario.nombre?.trim(),
    usuario.apellidos?.trim(),
  ].filter(
    (valor): valor is string =>
      Boolean(valor),
  );

  if (partes.length === 0) {
    return 'Usuario INGEVIT';
  }

  return partes.join(' ');
}

function obtenerMensajeExito(
  tipo: Exclude<
    TipoMensajeExito,
    null
  >,
): {
  titulo: string;
  descripcion: string;
} {
  switch (tipo) {
    case 'perfil':
      return {
        titulo: 'Perfil actualizado',
        descripcion:
          'Los cambios se guardaron correctamente.',
      };

    case 'password':
      return {
        titulo: 'Contraseña actualizada',
        descripcion:
          'La contraseña se cambió correctamente. Tu sesión se cerrará por seguridad.',
      };

    case 'avatar':
      return {
        titulo: 'Foto actualizada',
        descripcion:
          'Tu nueva foto de perfil se guardó correctamente.',
      };

    case 'avatar-eliminado':
      return {
        titulo: 'Foto eliminada',
        descripcion:
          'La foto de perfil se eliminó correctamente.',
      };
  }
}

export function ProfilePage({
  usuario,
  onUsuarioActualizado,
}: ProfilePageProps) {
  const [
    editando,
    setEditando,
  ] = useState(false);

  const [
    cambiandoPassword,
    setCambiandoPassword,
  ] = useState(false);

  const [
    editandoAvatar,
    setEditandoAvatar,
  ] = useState(false);

  const [
    tipoMensajeExito,
    setTipoMensajeExito,
  ] = useState<TipoMensajeExito>(
    null,
  );

  const [
    versionAvatar,
    setVersionAvatar,
  ] = useState(0);

  const temporizadorMensaje =
    useRef<number | null>(null);

  const temporizadorRedireccion =
    useRef<number | null>(null);

  const iniciales =
    obtenerIniciales(usuario);

  const nombreCompleto =
    obtenerNombreCompleto(usuario);

  const rolVisible =
    usuario.rol === 'ADMINISTRADOR'
      ? 'Administrador'
      : 'Usuario';

  const urlAvatar =
    usuario.foto_perfil_url
      ? `${usuario.foto_perfil_url}?v=${versionAvatar}`
      : null;

  useEffect(() => {
    return () => {
      if (
        temporizadorMensaje.current !==
        null
      ) {
        window.clearTimeout(
          temporizadorMensaje.current,
        );
      }

      if (
        temporizadorRedireccion.current !==
        null
      ) {
        window.clearTimeout(
          temporizadorRedireccion.current,
        );
      }
    };
  }, []);

  function limpiarTemporizadorMensaje() {
    if (
      temporizadorMensaje.current !==
      null
    ) {
      window.clearTimeout(
        temporizadorMensaje.current,
      );

      temporizadorMensaje.current =
        null;
    }
  }

  function mostrarMensajeExito(
    tipo: Exclude<
      TipoMensajeExito,
      null
    >,
  ) {
    limpiarTemporizadorMensaje();

    setTipoMensajeExito(tipo);

    temporizadorMensaje.current =
      window.setTimeout(() => {
        setTipoMensajeExito(null);

        temporizadorMensaje.current =
          null;
      }, 4000);
  }

  function abrirEdicion() {
    setEditando(true);
  }

  function cerrarEdicion() {
    setEditando(false);
  }

  function abrirCambioPassword() {
    setCambiandoPassword(true);
  }

  function cerrarCambioPassword() {
    setCambiandoPassword(false);
  }

  function abrirEditorAvatar() {
    setEditandoAvatar(true);
  }

  function cerrarEditorAvatar() {
    setEditandoAvatar(false);
  }

  function perfilActualizado(
    usuarioActualizado: Usuario,
  ) {
    setEditando(false);

    onUsuarioActualizado(
      usuarioActualizado,
    );

    mostrarMensajeExito(
      'perfil',
    );
  }

  function avatarActualizado(
    fotoPerfilUrl: string | null,
  ) {
    setEditandoAvatar(false);

    const usuarioActualizado: Usuario = {
      ...usuario,
      foto_perfil_url:
        fotoPerfilUrl,
    };

    onUsuarioActualizado(
      usuarioActualizado,
    );

    setVersionAvatar(
      (versionActual) =>
        versionActual + 1,
    );

    mostrarMensajeExito(
      fotoPerfilUrl
        ? 'avatar'
        : 'avatar-eliminado',
    );
  }

  function passwordActualizado() {
    limpiarTemporizadorMensaje();

    setCambiandoPassword(false);

    setTipoMensajeExito(
      'password',
    );

    temporizadorRedireccion.current =
      window.setTimeout(() => {
        window.location.reload();
      }, 3000);
  }

  const mensajeExito =
    tipoMensajeExito
      ? obtenerMensajeExito(
          tipoMensajeExito,
        )
      : null;

  return (
    <>
      <section className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>
              Mi Perfil
            </h1>

            <p className={styles.subtitle}>
              Consulta y administra la información
              asociada a tu cuenta.
            </p>
          </div>

          <button
            className={styles.editButton}
            type="button"
            onClick={abrirEdicion}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>

            <span>
              Editar perfil
            </span>
          </button>
        </header>

        <div className={styles.layout}>
          <aside className={styles.profileCard}>
            <button
              className={styles.avatarButton}
              type="button"
              onClick={abrirEditorAvatar}
              aria-label="Cambiar foto de perfil"
            >
              <span className={styles.avatar}>
                {urlAvatar ? (
                  <img
                    className={styles.avatarImage}
                    src={urlAvatar}
                    alt=""
                  />
                ) : (
                  iniciales
                )}
              </span>

              <span
                className={styles.avatarOverlay}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                >
                  <path d="M4 7h4l1.5-2h5L16 7h4v12H4Z" />
                  <circle
                    cx="12"
                    cy="13"
                    r="3"
                  />
                </svg>

                <span>
                  Cambiar foto
                </span>
              </span>
            </button>

            <h2>
              {nombreCompleto}
            </h2>

            <p className={styles.email}>
              {usuario.correo}
            </p>

            <span className={styles.roleBadge}>
              {rolVisible}
            </span>

            <div className={styles.accountStatus}>
              <span
                className={styles.statusDot}
                aria-hidden="true"
              />

              <span>
                Cuenta activa
              </span>
            </div>
          </aside>

          <div className={styles.content}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div className={styles.panelIcon}>
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
                </div>

                <div>
                  <h2>
                    Información personal
                  </h2>

                  <p>
                    Datos principales de tu perfil.
                  </p>
                </div>
              </header>

              <dl className={styles.dataGrid}>
                <div className={styles.dataItem}>
                  <dt>
                    Nombre
                  </dt>

                  <dd>
                    {usuario.nombre?.trim() ||
                      'No registrado'}
                  </dd>
                </div>

                <div className={styles.dataItem}>
                  <dt>
                    Apellidos
                  </dt>

                  <dd>
                    {usuario.apellidos?.trim() ||
                      'No registrados'}
                  </dd>
                </div>

                <div className={styles.dataItem}>
                  <dt>
                    Correo electrónico
                  </dt>

                  <dd>
                    {usuario.correo}
                  </dd>
                </div>

                <div className={styles.dataItem}>
                  <dt>
                    Teléfono
                  </dt>

                  <dd>
                    {usuario.telefono?.trim() ||
                      'No registrado'}
                  </dd>
                </div>

                <div className={styles.dataItem}>
                  <dt>
                    Ubicación
                  </dt>

                  <dd>
                    {usuario.ubicacion?.trim() ||
                      'No registrada'}
                  </dd>
                </div>

                <div className={styles.dataItem}>
                  <dt>
                    Rol
                  </dt>

                  <dd>
                    {rolVisible}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div className={styles.panelIcon}>
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="11"
                      width="14"
                      height="10"
                      rx="2"
                    />

                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </div>

                <div>
                  <h2>
                    Seguridad
                  </h2>

                  <p>
                    Configuración relacionada con el
                    acceso a tu cuenta.
                  </p>
                </div>
              </header>

              <div className={styles.securityContent}>
                <div className={styles.securityRow}>
                  <div>
                    <strong>
                      Contraseña
                    </strong>

                    <span>
                      Protege el acceso a tu cuenta
                      INGEVIT.
                    </span>
                  </div>

                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={abrirCambioPassword}
                  >
                    Cambiar contraseña
                  </button>
                </div>

                <div className={styles.securityRow}>
                  <div>
                    <strong>
                      Sesión
                    </strong>

                    <span>
                      Tu sesión actual está protegida
                      mediante autenticación segura.
                    </span>
                  </div>

                  <span className={styles.secureBadge}>
                    Activa
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      {mensajeExito && (
        <div
          className={styles.successMessage}
          role="status"
          aria-live="polite"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m7 12 3 3 7-7" />
          </svg>

          <div>
            <strong>
              {mensajeExito.titulo}
            </strong>

            <span>
              {mensajeExito.descripcion}
            </span>
          </div>
        </div>
      )}

      {editandoAvatar && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarEditorAvatar();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-avatar-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>
                  Mi Perfil
                </span>

                <h2 id="edit-avatar-title">
                  Foto de perfil
                </h2>

                <p>
                  Cambia o elimina la fotografía
                  asociada a tu cuenta.
                </p>
              </div>

              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={cerrarEditorAvatar}
                aria-label="Cerrar formulario"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className={styles.modalContent}>
              <ProfileAvatarEditor
                usuario={usuario}
                onActualizado={avatarActualizado}
                onCancelar={cerrarEditorAvatar}
              />
            </div>
          </section>
        </div>
      )}

      {editando && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarEdicion();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>
                  Mi Perfil
                </span>

                <h2 id="edit-profile-title">
                  Editar perfil
                </h2>

                <p>
                  Actualiza tu información personal.
                </p>
              </div>

              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={cerrarEdicion}
                aria-label="Cerrar formulario"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className={styles.modalContent}>
              <ProfileEditForm
                usuario={usuario}
                onActualizado={perfilActualizado}
                onCancelar={cerrarEdicion}
              />
            </div>
          </section>
        </div>
      )}

      {cambiandoPassword && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarCambioPassword();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>
                  Seguridad
                </span>

                <h2 id="change-password-title">
                  Cambiar contraseña
                </h2>

                <p>
                  Ingresa tu contraseña actual y
                  establece una nueva contraseña.
                </p>
              </div>

              <button
                className={styles.modalCloseButton}
                type="button"
                onClick={cerrarCambioPassword}
                aria-label="Cerrar formulario"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div className={styles.modalContent}>
              <ChangePasswordForm
                onCancel={cerrarCambioPassword}
                onSuccess={passwordActualizado}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}