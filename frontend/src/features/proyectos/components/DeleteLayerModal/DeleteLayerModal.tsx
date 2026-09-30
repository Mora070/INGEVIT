import {
  useEffect,
  useState,
} from 'react';

import {
  eliminarCapaProyecto,
} from '../../api/capas.api';

import type {
  CapaProyecto,
} from '../../types/capa';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './DeleteLayerModal.module.css';

interface DeleteLayerModalProps {
  idProyecto: string;

  capa: CapaProyecto;

  onCerrar: () => void;

  onEliminada: (
    idCapa: string,
  ) => void;
}

export function DeleteLayerModal({
  idProyecto,
  capa,
  onCerrar,
  onEliminada,
}: DeleteLayerModalProps) {
  const [
    eliminando,
    setEliminando,
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
      await eliminarCapaProyecto(
        idProyecto,
        capa.id_capa,
      );

      onEliminada(
        capa.id_capa,
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
          'No fue posible eliminar la ortofoto.',
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

  const procesando =
    capa.estado_procesamiento ===
    'PROCESANDO';

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
        aria-labelledby="delete-layer-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerInfo
            }
          >
            <h2
              id="delete-layer-title"
            >
              Eliminar ortofoto
            </h2>

            <p>
              Esta acción eliminará la capa del proyecto.
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
          <div
            className={
              styles.warning
            }
          >
            <span
              className={
                styles.warningIcon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <path d="M12 3 2.7 20h18.6L12 3Z" />

                <path d="M12 9v5" />

                <path d="M12 17h.01" />
              </svg>
            </span>

            <div
              className={
                styles.warningText
              }
            >
              <strong>
                Esta acción no se puede deshacer.
              </strong>

              <span>
                Se eliminarán la configuración y las teselas
                asociadas a esta ortofoto.
              </span>
            </div>
          </div>

          <div
            className={
              styles.layerInfo
            }
          >
            <span>
              Capa seleccionada
            </span>

            <strong
              title={
                capa.nombre
              }
            >
              {capa.nombre}
            </strong>

            <span
              title={
                capa.nombre_archivo_original
              }
            >
              {capa.nombre_archivo_original}
            </span>
          </div>

          {procesando && (
            <p
              className={
                styles.error
              }
              role="alert"
            >
              Esta capa se está procesando. Debes esperar
              a que termine antes de eliminarla.
            </p>
          )}

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
              eliminando ||
              procesando
            }
          >
            {eliminando
              ? 'Eliminando...'
              : 'Eliminar ortofoto'}
          </button>
        </footer>
      </section>
    </div>
  );
}