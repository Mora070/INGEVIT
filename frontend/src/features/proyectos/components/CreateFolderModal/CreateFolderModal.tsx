import {
  useEffect,
  useState,
} from 'react';

import {
  crearCarpetaProyecto,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
} from '../../types/carpeta';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './CreateFolderModal.module.css';

interface CreateFolderModalProps {
  idProyecto: string;

  idCarpetaPadre?: string | null;

  onCerrar: () => void;

  onCreada: (
    carpeta: CarpetaProyecto,
  ) => void;
}

export function CreateFolderModal({
  idProyecto,
  idCarpetaPadre = null,
  onCerrar,
  onCreada,
}: CreateFolderModalProps) {
  const [
    nombre,
    setNombre,
  ] = useState('');

  const [
    creando,
    setCreando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        !creando
      ) {
        onCerrar();
      }
    }

    window.addEventListener(
      'keydown',
      manejarEscape,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        manejarEscape,
      );
    };
  }, [
    creando,
    onCerrar,
  ]);

  useEffect(() => {
    const overflowAnterior =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        overflowAnterior;
    };
  }, []);

  const nombreLimpio =
    nombre.trim();

  const nombreValido =
    nombreLimpio.length > 0 &&
    nombreLimpio.length <= 150;

  const puedeCrear =
    nombreValido &&
    !creando;

  async function crear() {
    if (
      !puedeCrear
    ) {
      return;
    }

    setCreando(
      true,
    );

    setError(
      null,
    );

    try {
      const carpeta =
        await crearCarpetaProyecto(
          idProyecto,
          {
            nombre:
              nombreLimpio,

            id_carpeta_padre:
              idCarpetaPadre,
          },
        );

      onCreada(
        carpeta,
      );
    } catch (
      errorObtenido
    ) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible crear la carpeta.',
        );
      }
    } finally {
      setCreando(
        false,
      );
    }
  }

  function cerrarDesdeFondo(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
  ) {
    if (
      event.target ===
        event.currentTarget &&
      !creando
    ) {
      onCerrar();
    }
  }

  function manejarEnvio(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
  ) {
    event.preventDefault();

    void crear();
  }

  return (
    <div
      className={
        styles.overlay
      }
      onMouseDown={
        cerrarDesdeFondo
      }
      role="presentation"
    >
      <section
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-folder-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerIcon
            }
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
            >
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" />

              <path d="M12 10v5" />

              <path d="M9.5 12.5h5" />
            </svg>
          </div>

          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="create-folder-title"
            >
              Nueva carpeta
            </h2>

            <p>
              {idCarpetaPadre
                ? 'Crea una subcarpeta dentro de la ubicación actual.'
                : 'Crea una carpeta para organizar los recursos del proyecto.'}
            </p>
          </div>

          <button
            className={
              styles.closeButton
            }
            type="button"
            onClick={
              onCerrar
            }
            disabled={
              creando
            }
            aria-label="Cerrar"
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

        <form
          onSubmit={
            manejarEnvio
          }
        >
          <div
            className={
              styles.body
            }
          >
            <div
              className={
                styles.field
              }
            >
              <label
                htmlFor="nombre-carpeta"
              >
                Nombre de la carpeta
              </label>

              <input
                id="nombre-carpeta"
                type="text"
                value={
                  nombre
                }
                onChange={(
                  event,
                ) => {
                  setNombre(
                    event.target.value,
                  );

                  setError(
                    null,
                  );
                }}
                disabled={
                  creando
                }
                maxLength={
                  150
                }
                autoComplete="off"
                autoFocus
                placeholder="Ej. Avance de obra"
              />

              <div
                className={
                  styles.fieldMeta
                }
              >
                <span>
                  Máximo 150 caracteres
                </span>

                <span>
                  {nombre.length}/150
                </span>
              </div>
            </div>

            {error && (
              <p
                className={
                  styles.error
                }
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <footer
            className={
              styles.footer
            }
          >
            <button
              className={
                styles.cancelButton
              }
              type="button"
              onClick={
                onCerrar
              }
              disabled={
                creando
              }
            >
              Cancelar
            </button>

            <button
              className={
                styles.submitButton
              }
              type="submit"
              disabled={
                !puedeCrear
              }
            >
              {creando
                ? 'Creando...'
                : 'Crear carpeta'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}