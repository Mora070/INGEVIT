import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApiError } from '../../../../shared/api/http';
import { iniciarSesionGoogle } from '../../api/google.api';
import type { Usuario } from '../../types/usuario';

import styles from './GoogleLoginButton.module.css';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (
      response: GoogleCredentialResponse,
    ) => void;
  }) => void;

  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';

      theme?:
        | 'outline'
        | 'filled_blue'
        | 'filled_black';

      size?:
        | 'large'
        | 'medium'
        | 'small';

      text?:
        | 'signin_with'
        | 'signup_with'
        | 'continue_with'
        | 'signin';

      shape?:
        | 'rectangular'
        | 'pill'
        | 'circle'
        | 'square';

      width?: number;

      logo_alignment?:
        | 'left'
        | 'center';
    },
  ) => void;
}

interface GoogleIdentityServices {
  accounts: {
    id: GoogleAccountsId;
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

interface GoogleLoginButtonProps {
  onAutenticado: (
    usuario: Usuario,
  ) => void;
}

const GOOGLE_SCRIPT_ID =
  'google-identity-services';

const GOOGLE_SCRIPT_URL =
  'https://accounts.google.com/gsi/client';

export function GoogleLoginButton({
  onAutenticado,
}: GoogleLoginButtonProps) {
  const buttonContainer =
    useRef<HTMLDivElement | null>(null);

  const procesandoRef =
    useRef(false);

  const onAutenticadoRef =
    useRef(onAutenticado);

  const [error, setError] =
    useState<string | null>(null);

  const [procesando, setProcesando] =
    useState(false);

  /*
   * Conservamos siempre la versión más reciente
   * del callback sin reinicializar Google.
   */
  useEffect(() => {
    onAutenticadoRef.current =
      onAutenticado;
  }, [onAutenticado]);

  useEffect(() => {
    const clientId =
      import.meta.env
        .VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setError(
        'Google no está configurado en este entorno.',
      );

      return;
    }

    let desmontado = false;

    async function manejarCredential(
      respuesta: GoogleCredentialResponse,
    ) {
      if (
        desmontado ||
        procesandoRef.current
      ) {
        return;
      }

      const credential =
        respuesta.credential;

      if (!credential) {
        setError(
          'Google no devolvió una credencial válida.',
        );

        return;
      }

      procesandoRef.current = true;

      setProcesando(true);
      setError(null);

      try {
        const usuario =
          await iniciarSesionGoogle(
            credential,
          );

        if (desmontado) {
          return;
        }

        /*
         * El backend ya creó la cookie HttpOnly.
         * Ahora actualizamos inmediatamente
         * el estado del frontend.
         */
        onAutenticadoRef.current(
          usuario,
        );
      } catch (errorSolicitud) {
        if (desmontado) {
          return;
        }

        if (
          errorSolicitud instanceof
          ApiError
        ) {
          setError(
            errorSolicitud.message,
          );
        } else {
          setError(
            'No fue posible iniciar sesión con Google. Intenta nuevamente.',
          );
        }
      } finally {
        procesandoRef.current = false;

        if (!desmontado) {
          setProcesando(false);
        }
      }
    }

    function renderizarBoton() {
      if (
        desmontado ||
        !window.google ||
        !buttonContainer.current
      ) {
        return;
      }

      buttonContainer.current.innerHTML =
        '';

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: manejarCredential,
      });

      const anchoDisponible =
        buttonContainer.current
          .clientWidth;

      const anchoBoton =
        Math.min(
          Math.max(
            anchoDisponible,
            220,
          ),
          360,
        );

      window.google.accounts.id.renderButton(
        buttonContainer.current,
        {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: anchoBoton,
          logo_alignment: 'left',
        },
      );
    }

    const scriptExistente =
      document.getElementById(
        GOOGLE_SCRIPT_ID,
      ) as HTMLScriptElement | null;

    function manejarCarga() {
      renderizarBoton();
    }

    function manejarErrorCarga() {
      if (!desmontado) {
        setError(
          'No fue posible cargar el servicio de Google.',
        );
      }
    }

    if (
      scriptExistente &&
      window.google
    ) {
      renderizarBoton();
    } else {
      const script =
        scriptExistente ??
        document.createElement(
          'script',
        );

      if (!scriptExistente) {
        script.id =
          GOOGLE_SCRIPT_ID;

        script.src =
          GOOGLE_SCRIPT_URL;

        script.async = true;
        script.defer = true;

        document.head.appendChild(
          script,
        );
      }

      script.addEventListener(
        'load',
        manejarCarga,
      );

      script.addEventListener(
        'error',
        manejarErrorCarga,
      );
    }

    return () => {
      desmontado = true;

      const script =
        document.getElementById(
          GOOGLE_SCRIPT_ID,
        );

      script?.removeEventListener(
        'load',
        manejarCarga,
      );

      script?.removeEventListener(
        'error',
        manejarErrorCarga,
      );
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <div
        className={
          procesando
            ? styles.disabled
            : undefined
        }
      >
        <div
          className={
            styles.googleButton
          }
          ref={buttonContainer}
        />
      </div>

      {procesando && (
        <p
          className={styles.status}
          role="status"
        >
          Iniciando sesión con
          Google...
        </p>
      )}

      {error && (
        <p
          className={styles.error}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}