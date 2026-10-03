import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  actualizarCarpetaProyecto,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
} from '../../types/carpeta';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './RenameFolderModal.module.css';

interface RenameFolderModalProps {
  idProyecto: string;

  carpeta: CarpetaProyecto;

  onCerrar: () => void;

  onRenombrada: (
    carpeta: CarpetaProyecto,
  ) => void;
}

export function RenameFolderModal({
  idProyecto,
  carpeta,
  onCerrar,
  onRenombrada,
}: RenameFolderModalProps) {
  const inputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    nombre,
    setNombre,
  ] = useState(
    carpeta.nombre,
  );

  const [
    guardando,
    setGuardando,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  useEffect(() => {
    const input =
      inputRef.current;

    if (
      !input
    ) {
      return;
    }

    input.focus();
    input.select();
  }, []);

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        !guardando
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
    guardando,
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

  const nombreCambio =
    nombreLimpio !==
    carpeta.nombre;

  const nombreValido =
    nombreLimpio.length > 0 &&
    nombreLimpio.length <= 150;

  const puedeGuardar =
    nombreValido &&
    nombreCambio &&
    !guardando;

  async function guardar() {
    if (
      !puedeGuardar
    ) {
      return;
    }

    setGuardando(
      true,
    );

    setError(
      null,
    );

    try {
      const carpetaActualizada =
        await actualizarCarpetaProyecto(
          idProyecto,
          carpeta.id_carpeta,
          {
            nombre:
              nombreLimpio,
          },
        );

      onRenombrada(
        carpetaActualizada,
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
          'No fue posible renombrar la carpeta.',
        );
      }
    } finally {
      setGuardando(
        false,
      );
    }
  }

  function manejarEnvio(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
  ) {
    event.preventDefault();

    void guardar();
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
      !guardando
    ) {
      onCerrar();
    }
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
        aria-labelledby="rename-folder-title"
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
              <path d="M4 20h4l10-10-4-4L4 16v4Z" />

              <path d="m12.5 7.5 4 4" />
            </svg>
          </div>

          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="rename-folder-title"
            >
              Renombrar carpeta
            </h2>

            <p>
              Cambia el nombre de la carpeta sin modificar su contenido.
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
              guardando
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
                htmlFor="nuevo-nombre-carpeta"
              >
                Nombre de la carpeta
              </label>

              <input
                ref={
                  inputRef
                }
                id="nuevo-nombre-carpeta"
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
                  guardando
                }
                maxLength={
                  150
                }
                autoComplete="off"
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
                guardando
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
                !puedeGuardar
              }
            >
              {guardando
                ? 'Guardando...'
                : 'Guardar cambios'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}