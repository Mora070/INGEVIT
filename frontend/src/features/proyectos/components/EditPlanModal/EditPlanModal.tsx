import {
  useEffect,
  useState,
} from 'react';

import {
  actualizarPlanoProyecto,
} from '../../api/planos.api';

import type {
  PlanoProyecto,
} from '../../types/plano';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './EditPlanModal.module.css';

interface EditPlanModalProps {
  idProyecto: string;

  plano: PlanoProyecto;

  onCerrar: () => void;

  onActualizado: (
    plano: PlanoProyecto,
  ) => void;
}

export function EditPlanModal({
  idProyecto,
  plano,
  onCerrar,
  onActualizado,
}: EditPlanModalProps) {
  const [
    titulo,
    setTitulo,
  ] = useState(
    plano.titulo,
  );

  const [
    descripcion,
    setDescripcion,
  ] = useState(
    plano.descripcion,
  );

  const [
    guardando,
    setGuardando,
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

  const tituloLimpio =
    titulo.trim();

  const huboCambios =
    tituloLimpio !==
      plano.titulo ||
    descripcion !==
      plano.descripcion;

  const puedeGuardar =
    tituloLimpio.length >
      0 &&
    huboCambios &&
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
      const planoActualizado =
        await actualizarPlanoProyecto(
          idProyecto,
          plano.id_plano,
          {
            titulo:
              tituloLimpio,

            descripcion,
          },
        );

      onActualizado(
        planoActualizado,
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
          'No fue posible actualizar el plano.',
        );
      }
    } finally {
      setGuardando(
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
        aria-labelledby="edit-plan-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="edit-plan-title"
            >
              Editar plano
            </h2>

            <p>
              Modifica el título y la
              descripción del documento.
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
              htmlFor="edit-plan-title-input"
            >
              Título
            </label>

            <input
              id="edit-plan-title-input"
              type="text"
              value={
                titulo
              }
              onChange={(
                event,
              ) => {
                setTitulo(
                  event.target.value,
                );

                setError(
                  null,
                );
              }}
              disabled={
                guardando
              }
              autoFocus
            />
          </div>

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="edit-plan-description"
            >
              Descripción
            </label>

            <textarea
              id="edit-plan-description"
              value={
                descripcion
              }
              onChange={(
                event,
              ) => {
                setDescripcion(
                  event.target.value,
                );

                setError(
                  null,
                );
              }}
              disabled={
                guardando
              }
              rows={
                5
              }
            />
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
              styles.saveButton
            }
            type="button"
            onClick={() => {
              void guardar();
            }}
            disabled={
              !puedeGuardar
            }
          >
            {guardando
              ? 'Guardando...'
              : 'Guardar cambios'}
          </button>
        </footer>
      </section>
    </div>
  );
}