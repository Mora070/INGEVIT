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
  ] =
    useState<NavegacionProyecto | null>(
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

  async function salir() {
    if (
      salidaActiva.current
    ) {
      return;
    }

    salidaActiva.current =
      true;

    setCerrando(true);
    setErrorSalida(null);

    try {
      await cerrarSesion();

      actualizarUsuario(
        null,
      );

      setVistaAnonima(
        'login',
      );

      setSeccionWorkspace(
        'inicio',
      );

      setProyectoSeleccionadoId(
        null,
      );

      setNavegacionProyecto(
        null,
      );
    } catch (error) {
      if (
        error instanceof
          ApiError &&
        error.status ===
          401
      ) {
        actualizarUsuario(
          null,
        );

        setVistaAnonima(
          'login',
        );

        setSeccionWorkspace(
          'inicio',
        );

        setProyectoSeleccionadoId(
          null,
        );

        setNavegacionProyecto(
          null,
        );
      } else {
        setErrorSalida(
          'No pudimos cerrar la sesión. Inténtalo nuevamente.',
        );
      }
    } finally {
      salidaActiva.current =
        false;

      setCerrando(
        false,
      );
    }
  }

  function mostrarLogin() {
    setVistaAnonima(
      'login',
    );
  }

  function mostrarRegistro() {
    setVistaAnonima(
      'registro',
    );
  }

  function mostrarRecuperacion() {
    setVistaAnonima(
      'recuperacion',
    );
  }

  function mostrarInicio() {
    setSeccionWorkspace(
      'inicio',
    );

    setProyectoSeleccionadoId(
      null,
    );

    setNavegacionProyecto(
      null,
    );
  }

  function mostrarProyectos() {
    setSeccionWorkspace(
      'proyectos',
    );

    setProyectoSeleccionadoId(
      null,
    );

    setNavegacionProyecto(
      null,
    );
  }

  function mostrarPerfil() {
    setSeccionWorkspace(
      'perfil',
    );

    setProyectoSeleccionadoId(
      null,
    );

    setNavegacionProyecto(
      null,
    );
  }

  function abrirProyecto(
    idProyecto: string,
  ) {
    setSeccionWorkspace(
      'proyectos',
    );

    setProyectoSeleccionadoId(
      idProyecto,
    );

    setNavegacionProyecto(
      null,
    );
  }

  function abrirNotificacion(
    notificacion:
      Notificacion,
  ) {
    setSeccionWorkspace(
      'proyectos',
    );

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
    });
  }

  function volverAProyectos() {
    setProyectoSeleccionadoId(
      null,
    );

    setNavegacionProyecto(
      null,
    );

    setSeccionWorkspace(
      'proyectos',
    );
  }

  if (
    estado.tipo ===
    'cargando'
  ) {
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

  if (
    estado.tipo ===
    'error'
  ) {
    return (
      <main className="contenido">
        <section className="tarjeta estado">
          <h1>
            No pudimos comprobar tu
            sesión
          </h1>

          <p className="texto-secundario">
            Comprueba la conexión e
            inténtalo nuevamente.
          </p>

          <button
            className="boton principal"
            type="button"
            onClick={
              reintentar
            }
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  if (
    estado.tipo ===
    'anonima'
  ) {
    if (
      vistaAnonima ===
      'registro'
    ) {
      return (
        <RegisterPage
          onIrLogin={
            mostrarLogin
          }
        />
      );
    }

    if (
      vistaAnonima ===
      'recuperacion'
    ) {
      return (
        <RecoveryPage
          onVolverLogin={
            mostrarLogin
          }
        />
      );
    }

    return (
      <LoginPage
        onAutenticado={
          actualizarUsuario
        }
        onIrRegistro={
          mostrarRegistro
        }
        onIrRecuperacion={
          mostrarRecuperacion
        }
      />
    );
  }

  return (
    <AppShell
      usuario={
        estado.usuario
      }
      seccionActiva={
        seccionWorkspace
      }
      onIrInicio={
        mostrarInicio
      }
      onIrProyectos={
        mostrarProyectos
      }
      onIrPerfil={
        mostrarPerfil
      }
      onAbrirNotificacion={
        abrirNotificacion
      }
      onCerrarSesion={
        salir
      }
      cerrandoSesion={
        cerrando
      }
    >
      {errorSalida && (
        <p
          className="mensaje-error"
          role="alert"
        >
          {errorSalida}
        </p>
      )}

      {seccionWorkspace ===
        'inicio' && (
        <HomePage />
      )}

      {seccionWorkspace ===
        'proyectos' &&
        proyectoSeleccionadoId ===
          null && (
          <ProjectsPage
            onAbrirProyecto={
              abrirProyecto
            }
          />
        )}

      {seccionWorkspace ===
        'proyectos' &&
        proyectoSeleccionadoId !==
          null && (
          <ProjectDetailPage
            idProyecto={
              proyectoSeleccionadoId
            }
            idUsuarioActual={
              estado.usuario.id_usuario
            }
            navegacionInicial={
              navegacionProyecto
            }
            onVolver={
              volverAProyectos
            }
          />
        )}

      {seccionWorkspace ===
        'perfil' && (
        <ProfilePage
          usuario={
            estado.usuario
          }
          onUsuarioActualizado={
            actualizarUsuario
          }
        />
      )}
    </AppShell>
  );
}