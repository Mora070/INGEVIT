import { useRef, useState } from 'react';

import LoginForm from './features/auth/components/LoginForm';
import { RegisterPage } from './features/auth/pages/RegisterPage/RegisterPage';
import { useSesion } from './features/auth/hooks/useSesion';
import { cerrarSesion } from './features/auth/api/auth.api';
import { ApiError } from './shared/api/http';

type VistaAnonima = 'login' | 'registro';

/**
 * Composición provisional de la aplicación.
 *
 * Mientras terminamos la navegación definitiva:
 * - Registro utiliza una página completa independiente.
 * - Login conserva temporalmente la pantalla existente.
 * - La zona autenticada continúa con la bienvenida provisional.
 *
 * El backend sigue siendo responsable de autorizar cada operación.
 */
export default function App() {
  const { estado, actualizarUsuario, reintentar } = useSesion();

  const [vistaAnonima, setVistaAnonima] =
    useState<VistaAnonima>('login');

  const [cerrando, setCerrando] = useState(false);
  const [errorSalida, setErrorSalida] = useState<string | null>(null);

  const salidaActiva = useRef(false);

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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        actualizarUsuario(null);
        setVistaAnonima('login');
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

  /*
   * Registro ocupa toda la ventana y no hereda el header ni el
   * contenedor provisional de la aplicación.
   *
   * Después de crear la cuenta, RegisterForm llama onIrLogin y
   * volvemos al login. El registro NO inicia sesión automáticamente.
   */
  if (
    estado.tipo === 'anonima' &&
    vistaAnonima === 'registro'
  ) {
    return (
      <RegisterPage
        onIrLogin={mostrarLogin}
      />
    );
  }

  return (
    <div className="aplicacion">
      <header className="cabecera">
        <a
          className="marca"
          href="/"
          aria-label="INGEVIT, inicio"
        >
          <span
            className="marca-icono"
            aria-hidden="true"
          >
            I
          </span>

          INGEVIT
        </a>

        <span className="cabecera-descripcion">
          Gestión de proyectos
        </span>
      </header>

      <main className="contenido">
        {estado.tipo === 'cargando' && (
          <section
            className="tarjeta estado"
            role="status"
          >
            <h1>Comprobando tu sesión…</h1>

            <p className="texto-secundario">
              Espera un momento.
            </p>
          </section>
        )}

        {estado.tipo === 'error' && (
          <section className="tarjeta estado">
            <h1>No pudimos comprobar tu sesión</h1>

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
        )}

        {estado.tipo === 'anonima' && (
          <>
            <div className="selector-auth">
              <button
                type="button"
                className="boton principal"
                aria-current="page"
                onClick={mostrarLogin}
              >
                Iniciar sesión
              </button>

              <button
                type="button"
                className="boton secundario"
                onClick={mostrarRegistro}
              >
                Crear cuenta
              </button>
            </div>

            <LoginForm
              onAutenticado={actualizarUsuario}
            />
          </>
        )}

        {estado.tipo === 'autenticada' && (
          <section className="tarjeta bienvenida">
            <span className="etiqueta">
              Tu espacio de trabajo
            </span>

            <h1>
              Hola,{' '}
              {estado.usuario.nombre ||
                estado.usuario.correo}
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
              <p
                className="mensaje-error"
                role="alert"
              >
                {errorSalida}
              </p>
            )}

            <button
              className="boton secundario"
              type="button"
              onClick={salir}
              disabled={cerrando}
            >
              {cerrando
                ? 'Cerrando sesión…'
                : 'Cerrar sesión'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}