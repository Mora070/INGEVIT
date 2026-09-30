import {
  useEffect,
  useState,
} from 'react';

import {
  eliminarPlanoProyecto,
} from '../../api/planos.api';

import type {
  PlanoProyecto,
} from '../../types/plano';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './DeletePlanModal.module.css';

interface DeletePlanModalProps {
  idProyecto: string;

  plano: PlanoProyecto;

  onCerrar: () => void;

  onEliminado: (
    idPlano: string,
  ) => void;
}

export function DeletePlanModal({
  idProyecto,
  plano,
  onCerrar,
  onEliminado,
}: DeletePlanModalProps) {
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
      await eliminarPlanoProyecto(
        idProyecto,
        plano.id_plano,
      );

      onEliminado(
        plano.id_plano,
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
          'No fue posible eliminar el plano.',
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-plan-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.icon
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 6h18" />

              <path d="M8 6V4h8v2" />

              <path d="m19 6-1 14H6L5 6" />

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
              id="delete-plan-title"
            >
              Eliminar plano
            </h2>

            <p>
              Esta acción eliminará el
              documento del proyecto.
            </p>
          </div>
        </header>

        <div
          className={
            styles.planInfo
          }
        >
          <span>
            Plano seleccionado
          </span>

          <strong>
            {plano.titulo}
          </strong>
        </div>

        <p
          className={
            styles.warning
          }
        >
          También se eliminarán las
          asociaciones relacionadas con
          este plano. Esta acción no se
          puede deshacer.
        </p>

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
              : 'Eliminar plano'}
          </button>
        </footer>
      </section>
    </div>
  );
}