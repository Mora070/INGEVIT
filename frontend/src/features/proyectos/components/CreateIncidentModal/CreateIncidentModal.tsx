import {
  useEffect,
  useState,
} from 'react';

import {
  crearIncidenciaPlano,
} from '../../api/incidencias.api';

import type {
  IncidenciaPlano,
  PrioridadIncidencia,
} from '../../types/incidencia';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './CreateIncidentModal.module.css';

interface CreateIncidentModalProps {
  idProyecto: string;

  idPlano: string;

  numeroPagina: number;

  coordenadaX: number;

  coordenadaY: number;

  onCerrar: () => void;

  onCreada: (
    incidencia: IncidenciaPlano,
  ) => void;
}

export function CreateIncidentModal({
  idProyecto,
  idPlano,
  numeroPagina,
  coordenadaX,
  coordenadaY,
  onCerrar,
  onCreada,
}: CreateIncidentModalProps) {
  const [
    titulo,
    setTitulo,
  ] = useState('');

  const [
    descripcion,
    setDescripcion,
  ] = useState('');

  const [
    prioridad,
    setPrioridad,
  ] = useState<PrioridadIncidencia>(
    'MEDIA',
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

  const tituloValido =
    titulo.trim().length >
    0;

  const descripcionValida =
    descripcion.trim().length >
    0;

  const puedeCrear =
    tituloValido &&
    descripcionValida &&
    !guardando;

  async function crear() {
    if (
      !puedeCrear
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
      const nuevaIncidencia =
        await crearIncidenciaPlano(
          idProyecto,
          idPlano,
          {
            titulo:
              titulo.trim(),

            descripcion:
              descripcion.trim(),

            prioridad,

            numeroPagina,

            coordenadaX,

            coordenadaY,
          },
        );

      onCreada(
        nuevaIncidencia,
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
          'No fue posible crear la incidencia.',
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
        aria-labelledby="create-incident-title"
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
              id="create-incident-title"
            >
              Nueva incidencia
            </h2>

            <p>
              Registra una incidencia
              vinculada al punto seleccionado
              del plano.
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
              styles.positionCard
            }
          >
            <div>
              <span>
                Página
              </span>

              <strong>
                {numeroPagina}
              </strong>
            </div>

            <div>
              <span>
                Posición X
              </span>

              <strong>
                {(
                  coordenadaX *
                  100
                ).toFixed(
                  1,
                )}
                %
              </strong>
            </div>

            <div>
              <span>
                Posición Y
              </span>

              <strong>
                {(
                  coordenadaY *
                  100
                ).toFixed(
                  1,
                )}
                %
              </strong>
            </div>
          </div>

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="incident-title"
            >
              Título
            </label>

            <input
              id="incident-title"
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
              htmlFor="incident-description"
            >
              Descripción
            </label>

            <textarea
              id="incident-description"
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
              placeholder="Describe el problema encontrado en este punto del plano."
            />
          </div>

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="incident-priority"
            >
              Prioridad
            </label>

            <select
              id="incident-priority"
              value={
                prioridad
              }
              onChange={(
                event,
              ) => {
                setPrioridad(
                  event.target
                    .value as PrioridadIncidencia,
                );

                setError(
                  null,
                );
              }}
              disabled={
                guardando
              }
            >
              <option value="BAJA">
                Baja
              </option>

              <option value="MEDIA">
                Media
              </option>

              <option value="ALTA">
                Alta
              </option>
            </select>
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
              styles.createButton
            }
            type="button"
            onClick={() => {
              void crear();
            }}
            disabled={
              !puedeCrear
            }
          >
            {guardando
              ? 'Creando...'
              : 'Crear incidencia'}
          </button>
        </footer>
      </section>
    </div>
  );
}