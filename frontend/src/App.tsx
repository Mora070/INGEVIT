import { useRef, useState } from 'react';

import LoginForm from './features/auth/components/LoginForm';
import { useSesion } from './features/auth/hooks/useSesion';
import { cerrarSesion } from './features/auth/api/auth.api';
import { ApiError } from './shared/api/http';

/**
 * Primera pantalla protegida.
 * El backend continúa siendo responsable de autorizar cada operación.
 */
export default function App() {
  const { estado, actualizarUsuario, reintentar } = useSesion();
  const [cerrando, setCerrando] = useState(false);
  const [errorSalida, setErrorSalida] = useState<string | null>(null);
  const salidaActiva = useRef(false);

  async function salir() {
    if (salidaActiva.current) return;

    salidaActiva.current = true;
    setCerrando(true);
    setErrorSalida(null);

    try {
      await cerrarSesion();
      actualizarUsuario(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        actualizarUsuario(null);
      } else {
        // No simulamos un cierre correcto si el servidor no lo confirmó.
        setErrorSalida(
          'No pudimos cerrar la sesión. Inténtalo nuevamente.',
        );
      }
    } finally {
      salidaActiva.current = false;
      setCerrando(false);
    }
  }

  return (
    <div className="aplicacion">
      <header className="cabecera">
        <a className="marca" href="/" aria-label="INGEVIT, inicio">
          <span className="marca-icono" aria-hidden="true">I</span>
          INGEVIT
        </a>
        <span className="cabecera-descripcion">Gestión de proyectos</span>
      </header>

      <main className="contenido">
        {estado.tipo === 'cargando' && (
          <section className="tarjeta estado" role="status">
            <h1>Comprobando tu sesión…</h1>
            <p className="texto-secundario">Espera un momento.</p>
          </section>
        )}

        {estado.tipo === 'error' && (
          <section className="tarjeta estado">
            <h1>No pudimos comprobar tu sesión</h1>
            <p className="texto-secundario">
              Comprueba la conexión e inténtalo nuevamente.
            </p>
            <button className="boton principal" onClick={reintentar}>
              Reintentar
            </button>
          </section>
        )}

        {estado.tipo === 'anonima' && (
          <LoginForm onAutenticado={actualizarUsuario} />
        )}

        {estado.tipo === 'autenticada' && (
          <section className="tarjeta bienvenida">
            <span className="etiqueta">Tu espacio de trabajo</span>
            <h1>
              Hola, {estado.usuario.nombre || estado.usuario.correo}
            </h1>
            <p className="texto-secundario">
              Has iniciado sesión correctamente.
            </p>

            <dl className="datos-perfil">
              <div>
                <dt>Correo</dt>
                <dd>{estado.usuario.correo}</dd>
              </div>
              <div>
                <dt>Rol</dt>
                <dd>
                  {estado.usuario.rol === 'ADMINISTRADOR'
                    ? 'Administrador'
                    : 'Usuario'}
                </dd>
              </div>
            </dl>

            {errorSalida && (
              <p className="mensaje-error" role="alert">{errorSalida}</p>
            )}

            <button
              className="boton secundario"
              onClick={salir}
              disabled={cerrando}
            >
              {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}