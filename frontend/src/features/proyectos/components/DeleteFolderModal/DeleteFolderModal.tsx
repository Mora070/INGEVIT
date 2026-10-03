import {
  useEffect,
  useState,
} from 'react';

import {
  eliminarCarpetaProyecto,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
} from '../../types/carpeta';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './DeleteFolderModal.module.css';

interface DeleteFolderModalProps {
  idProyecto: string;

  carpeta: CarpetaProyecto;

  onCerrar: () => void;

  onEliminada: (
    carpeta: CarpetaProyecto,
  ) => void;
}

export function DeleteFolderModal({
  idProyecto,
  carpeta,
  onCerrar,
  onEliminada,
}: DeleteFolderModalProps) {
  const [
    eliminando,
    setEliminando,
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
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        !eliminando
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
    eliminando,
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

  async function eliminar() {
    if (
      eliminando
    ) {
      return;
    }

    setEliminando(
      true,
    );

    setError(
      null,
    );

    try {
      await eliminarCarpetaProyecto(
        idProyecto,
        carpeta.id_carpeta,
      );

      onEliminada(
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
          'No fue posible eliminar la carpeta.',
        );
      }
    } finally {
      setEliminando(
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
      !eliminando
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-folder-title"
        aria-describedby="delete-folder-description"
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
              <path d="M4 7h16" />

              <path d="M9 7V4h6v3" />

              <path d="M6.5 7 7.3 20h9.4l.8-13" />

              <path d="M10 11v5" />

              <path d="M14 11v5" />
            </svg>
          </div>

          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="delete-folder-title"
            >
              Eliminar carpeta
            </h2>

            <p
              id="delete-folder-description"
            >
              Esta acción eliminará la carpeta de la organización del proyecto.
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
              eliminando
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

        <div
          className={
            styles.body
          }
        >
          <p
            className={
              styles.question
            }
          >
            ¿Seguro que deseas eliminar la carpeta{' '}
            <strong>
              {carpeta.nombre}
            </strong>
            ?
          </p>

          <div
            className={
              styles.notice
            }
          >
            <div
              className={
                styles.noticeIcon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />

                <path d="M12 10v6" />

                <path d="M12 7h.01" />
              </svg>
            </div>

            <div>
              <strong>
                Los archivos originales no serán eliminados.
              </strong>

              <p>
                Las fotografías, panorámicas y planos seguirán disponibles en sus secciones originales del proyecto.
              </p>
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
              eliminando
            }
          >
            Cancelar
          </button>

          <button
            className={
              styles.deleteButton
            }
            type="button"
            onClick={() => {
              void eliminar();
            }}
            disabled={
              eliminando
            }
          >
            {eliminando
              ? 'Eliminando...'
              : 'Eliminar carpeta'}
          </button>
        </footer>
      </section>
    </div>
  );
}