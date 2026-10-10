
import {
  useRef,
  useState,
} from 'react';

import {
  cerrarSesion,
} from './features/auth/api/auth.api';

import {
  useSesion,
} from './features/auth/hooks/useSesion';

import type {
  Usuario,
} from './features/auth/types/usuario';

import {
  ProfilePage,
} from './features/profile/pages/ProfilePage/ProfilePage';

import {
  LoginPage,
} from './features/auth/pages/LoginPage/LoginPage';

import {
  RecoveryPage,
} from './features/auth/pages/RecoveryPage/RecoveryPage';

import {
  RegisterPage,
} from './features/auth/pages/RegisterPage/RegisterPage';

import {
  ProjectsPage,
} from './features/proyectos/pages/ProjectsPage/ProjectsPage';

import {
  ProjectDetailPage,
} from './features/proyectos/pages/ProjectDetailPage/ProjectDetailPage';

import {
  AppShell,
  type SeccionWorkspace,
} from './features/workspace/components/AppShell/AppShell';

import {
  HomePage,
} from './features/workspace/pages/HomePage/HomePage';

import type {
  Notificacion,
} from './features/workspace/api/notificaciones.api';

import type {
  NavegacionProyecto,
} from './features/proyectos/types/navegacion-proyecto';

import {
  ApiError,
} from './shared/api/http';

type VistaAnonima =
  | 'login'
  | 'registro'
  | 'recuperacion';

export default function App() {
  const {
    estado,
    actualizarUsuario,
    reintentar,
  } = useSesion();

  // Versión centralizada de la fotografía.
  // Se comparte entre AppShell y ProfilePage.
  const [
    versionAvatar,
    setVersionAvatar,
  ] = useState(0);

  const [
    vistaAnonima,
    setVistaAnonima,
  ] = useState<VistaAnonima>(
    'login',
  );

  const [
    seccionWorkspace,
    setSeccionWorkspace,
  ] = useState<SeccionWorkspace>(
    'inicio',
  );

  const [
    proyectoSeleccionadoId,
    setProyectoSeleccionadoId,
  ] = useState<string | null>(
    null,
  );

  const [
    navegacionProyecto,
    setNavegacionProyecto,
  ] = useState<NavegacionProyecto | null>(
    null,
  );

  const [
    cerrando,
    setCerrando,
  ] = useState(false);

  const [
    errorSalida,
    setErrorSalida,
  ] = useState<string | null>(
    null,
  );

  const salidaActiva =
    useRef(false);

  /**
   * Actualiza la sesión y fuerza una nueva
   * versión visual de la fotografía.
   *
   * Esto permite actualizar inmediatamente
   * el avatar aunque el backend devuelva
   * exactamente la misma URL.
   */
  function actualizarAvatarUsuario(
    usuarioActualizado: Usuario,
  ) {
    actualizarUsuario(
      usuarioActualizado,
    );

    setVersionAvatar(
      (versionActual) => versionActual + 1,
    );
  }

  /**
   * Cierre de sesión.
   */
  async function salir() {
    if (salidaActiva.current) {
      return;
    }

    salidaActiva.current = true;

    setCerrando(true);
    setErrorSalida(null);

    try {
      await cerrarSesion();

      actualizarUsuario(null);

      setVersionAvatar(0);
      setVistaAnonima('login');
      setSeccionWorkspace('inicio');
      setProyectoSeleccionadoId(null);
      setNavegacionProyecto(null);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        actualizarUsuario(null);

        setVersionAvatar(0);
        setVistaAnonima('login');
        setSeccionWorkspace('inicio');
        setProyectoSeleccionadoId(null);
        setNavegacionProyecto(null);
      } else {
        setErrorSalida(
          'No pudimos cerrar la sesión. Inténtalo nuevamente.',
        );
      }
    } finally {
      salidaActiva.current = false;
      setCerrando(false);
    }
  }

  /**
   * Navegación de autenticación.
   */
  function mostrarLogin() {
    setVistaAnonima('login');
  }

  function mostrarRegistro() {
    setVistaAnonima('registro');
  }

  function mostrarRecuperacion() {
    setVistaAnonima('recuperacion');
  }

  /**
   * Navegación del workspace.
   */
  function mostrarInicio() {
    setSeccionWorkspace('inicio');
    setProyectoSeleccionadoId(null);
    setNavegacionProyecto(null);
  }

  function mostrarProyectos() {
    setSeccionWorkspace('proyectos');
    setProyectoSeleccionadoId(null);
    setNavegacionProyecto(null);
  }

  function mostrarPerfil() {
    setSeccionWorkspace('perfil');
    setProyectoSeleccionadoId(null);
    setNavegacionProyecto(null);
  }

  /**
   * Abrir un proyecto.
   */
  function abrirProyecto(
    idProyecto: string,
  ) {
    setSeccionWorkspace('proyectos');
    setProyectoSeleccionadoId(idProyecto);
    setNavegacionProyecto(null);
  }

  /**
   * Abrir el recurso relacionado
   * con una notificación.
   */
  function abrirNotificacion(
    notificacion: Notificacion,
  ) {
    setSeccionWorkspace('proyectos');

    setProyectoSeleccionadoId(
      notificacion.id_proyecto,
    );

    setNavegacionProyecto({
      clave:
        notificacion.id_notificacion,

      destino:
        notificacion.destino,

      idRecurso:
        notificacion.id_recurso ??
        notificacion.id_incidencia,

      idIncidencia:
        notificacion.id_incidencia,
    });
  }

  /**
   * Regresar al listado de proyectos.
   */
  function volverAProyectos() {
    setProyectoSeleccionadoId(null);
    setNavegacionProyecto(null);
    setSeccionWorkspace('proyectos');
  }

  /**
   * Comprobación inicial de sesión.
   */
  if (estado.tipo === 'cargando') {
    return (
      <main className="contenido">
        <section
          className="tarjeta estado"
          role="status"
        >
          <h1>
            Comprobando tu sesión…
          </h1>

          <p className="texto-secundario">
            Espera un momento.
          </p>
        </section>
      </main>
    );
  }

  /**
   * Error al comprobar sesión.
   */
  if (estado.tipo === 'error') {
    return (
      <main className="contenido">
        <section className="tarjeta estado">
          <h1>
            No pudimos comprobar tu sesión
          </h1>

          <p className="texto-secundario">
            Comprueba la conexión e inténtalo
            nuevamente.
          </p>

          <button
            className="boton principal"
            type="button"
            onClick={reintentar}
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  /**
   * Usuario sin sesión.
   */
  if (estado.tipo === 'anonima') {
    if (vistaAnonima === 'registro') {
      return (
        <RegisterPage
          onIrLogin={mostrarLogin}
        />
      );
    }

    if (vistaAnonima === 'recuperacion') {
      return (
        <RecoveryPage
          onVolverLogin={mostrarLogin}
        />
      );
    }

    return (
      <LoginPage
        onAutenticado={actualizarUsuario}
        onIrRegistro={mostrarRegistro}
        onIrRecuperacion={mostrarRecuperacion}
      />
    );
  }

  /**
   * Workspace autenticado.
   *
   * AppShell y ProfilePage reciben
   * el mismo usuario y la misma
   * versión de fotografía.
   */
  return (
    <AppShell
      usuario={estado.usuario}
      versionAvatar={versionAvatar}
      seccionActiva={seccionWorkspace}
      onIrInicio={mostrarInicio}
      onIrProyectos={mostrarProyectos}
      onIrPerfil={mostrarPerfil}
      onAbrirNotificacion={abrirNotificacion}
      onCerrarSesion={salir}
      cerrandoSesion={cerrando}
    >
      {errorSalida && (
        <p
          className="mensaje-error"
          role="alert"
        >
          {errorSalida}
        </p>
      )}

      {seccionWorkspace === 'inicio' && (
        <HomePage
          usuario={estado.usuario}
          versionAvatar={versionAvatar}
        />
      )}

      {seccionWorkspace === 'proyectos' &&
        proyectoSeleccionadoId === null && (
          <ProjectsPage
            onAbrirProyecto={abrirProyecto}
          />
        )}

      {seccionWorkspace === 'proyectos' &&
        proyectoSeleccionadoId !== null && (
          <ProjectDetailPage
            idProyecto={proyectoSeleccionadoId}
            idUsuarioActual={
              estado.usuario.id_usuario
            }
            navegacionInicial={
              navegacionProyecto
            }
            onVolver={volverAProyectos}
          />
        )}

      {seccionWorkspace === 'perfil' && (
        <ProfilePage
          usuario={estado.usuario}
          versionAvatar={versionAvatar}
          onUsuarioActualizado={
            actualizarUsuario
          }
          onAvatarActualizado={
            actualizarAvatarUsuario
          }
        />
      )}
    </AppShell>
  );
}
