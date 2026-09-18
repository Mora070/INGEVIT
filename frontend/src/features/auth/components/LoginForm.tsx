import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { iniciarSesion } from '../api/auth.api';
import type { Usuario } from '../types/usuario';
import { ApiError } from '../../../shared/api/http';

interface LoginFormProps {
  onAutenticado: (usuario: Usuario) => void;
}

export default function LoginForm({ onAutenticado }: LoginFormProps) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitudActiva = useRef(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Impide envíos repetidos antes de que React actualice el botón.
    if (solicitudActiva.current) return;

    solicitudActiva.current = true;
    setEnviando(true);
    setError(null);

    try {
      const usuario = await iniciarSesion({
        correo: correo.trim(),
        // La contraseña se conserva exactamente como fue escrita.
        password,
      });

      setPassword('');
      onAutenticado(usuario);
    } catch (fallo) {
      setError(
        fallo instanceof ApiError
          ? fallo.message
          : 'No pudimos conectar con el servidor. Inténtalo nuevamente.',
      );
    } finally {
      solicitudActiva.current = false;
      setEnviando(false);
    }
  }

  return (
    <section className="tarjeta acceso" aria-labelledby="titulo-login">
      <span className="etiqueta">Acceso a tu cuenta</span>
      <h1 id="titulo-login">Bienvenido a INGEVIT</h1>
      <p className="texto-secundario">
        Ingresa para gestionar tus proyectos y consultar sus avances.
      </p>

      <form onSubmit={enviar} aria-busy={enviando}>
        <div className="campo">
          <label htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={correo}
            onChange={(event) => setCorreo(event.target.value)}
            disabled={enviando}
          />
        </div>

        <div className="campo">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={enviando}
          />
        </div>

        {/* Login no exige la longitud de contraseñas nuevas:
            conserva compatibilidad con cuentas anteriores. */}
        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <button className="boton principal" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Iniciar sesión'}
        </button>
      </form>
    </section>
  );
}