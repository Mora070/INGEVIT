import { useRef, useState } from 'react';

import { cerrarSesion } from './features/auth/api/auth.api';
import { useSesion } from './features/auth/hooks/useSesion';
import { ProfilePage } from './features/profile/pages/ProfilePage/ProfilePage';
import { LoginPage } from './features/auth/pages/LoginPage/LoginPage';
import { RecoveryPage } from './features/auth/pages/RecoveryPage/RecoveryPage';
import { RegisterPage } from './features/auth/pages/RegisterPage/RegisterPage';
import { ProjectsPage } from './features/proyectos/pages/ProjectsPage/ProjectsPage';

import {
  AppShell,
  type SeccionWorkspace,
} from './features/workspace/components/AppShell/AppShell';

import { HomePage } from './features/workspace/pages/HomePage/HomePage';

import { ApiError } from './shared/api/http';

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
  ] = useState<VistaAnonima>('login');

  const [
    seccionWorkspace,
    setSeccionWorkspace,
  ] = useState<SeccionWorkspace>('inicio');

  const [
    cerrando,
    setCerrando,
  ] = useState(false);

  const [
    errorSalida,
    setErrorSalida,
  ] = useState<string | null>(null);

  const salidaActiva =
    useRef(false);

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

      setVistaAnonima('login');
      setSeccionWorkspace('inicio');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        actualizarUsuario(null);

        setVistaAnonima('login');
        setSeccionWorkspace('inicio');
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

  function mostrarLogin() {
    setVistaAnonima('login');
  }

  function mostrarRegistro() {
    setVistaAnonima('registro');
  }

  function mostrarRecuperacion() {
    setVistaAnonima('recuperacion');
  }

  function mostrarInicio() {
    setSeccionWorkspace('inicio');
  }

  function mostrarProyectos() {
    setSeccionWorkspace('proyectos');
  }

  function mostrarPerfil() {
    setSeccionWorkspace('perfil');
  }

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

  if (estado.tipo === 'error') {
    return (
      <main className="contenido">
        <section className="tarjeta estado">
          <h1>
            No pudimos comprobar tu sesión
          </h1>

          <p className="texto-secundario">
            Comprueba la conexión e inténtalo nuevamente.
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

  return (
    <AppShell
      usuario={estado.usuario}
      seccionActiva={seccionWorkspace}
      onIrInicio={mostrarInicio}
      onIrProyectos={mostrarProyectos}
      onIrPerfil={mostrarPerfil}
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
        <HomePage />
      )}

      {seccionWorkspace === 'proyectos' && (
        <ProjectsPage />
      )}

      {seccionWorkspace === 'perfil' && (
        <ProfilePage
          usuario={estado.usuario}
          onUsuarioActualizado={actualizarUsuario}
        />
      )}
    </AppShell>
  );
}