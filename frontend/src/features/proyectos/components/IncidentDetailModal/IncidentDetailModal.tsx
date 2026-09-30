import {
  useEffect,
  useState,
} from 'react';

import {
  actualizarIncidenciaPlano,
  eliminarIncidenciaPlano,
} from '../../api/incidencias.api';

import type {
  EstadoIncidencia,
  IncidenciaPlano,
  PrioridadIncidencia,
} from '../../types/incidencia';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './IncidentDetailModal.module.css';

interface IncidentDetailModalProps {
  incidencia: IncidenciaPlano;

  onCerrar: () => void;

  onActualizada: (
    incidencia: IncidenciaPlano,
  ) => void;

  onEliminada: (
    idIncidencia: string,
  ) => void;
}

function formatearPrioridad(
  prioridad: PrioridadIncidencia,
): string {
  if (
    prioridad ===
    'BAJA'
  ) {
    return 'Baja';
  }

  if (
    prioridad ===
    'MEDIA'
  ) {
    return 'Media';
  }

  return 'Alta';
}

function formatearEstado(
  estado: EstadoIncidencia,
): string {
  if (
    estado ===
    'PENDIENTE'
  ) {
    return 'Pendiente';
  }

  if (
    estado ===
    'EN_PROCESO'
  ) {
    return 'En proceso';
  }

  return 'Solucionada';
}

function formatearFecha(
  fecha: string,
): string {
  const valor =
    new Date(fecha);

  if (
    Number.isNaN(
      valor.getTime(),
    )
  ) {
    return fecha;
  }

  return new Intl.DateTimeFormat(
    'es-CO',
    {
      day:
        'numeric',

      month:
        'short',

      year:
        'numeric',

      hour:
        '2-digit',

      minute:
        '2-digit',
    },
  ).format(valor);
}

export function IncidentDetailModal({
  incidencia,
  onCerrar,
  onActualizada,
  onEliminada,
}: IncidentDetailModalProps) {
  const [
    editando,
    setEditando,
  ] = useState(false);

  const [
    confirmandoEliminacion,
    setConfirmandoEliminacion,
  ] = useState(false);

  const [
    titulo,
    setTitulo,
  ] = useState(
    incidencia.titulo,
  );

  const [
    descripcion,
    setDescripcion,
  ] = useState(
    incidencia.descripcion,
  );

  const [
    prioridad,
    setPrioridad,
  ] = useState<PrioridadIncidencia>(
    incidencia.prioridad,
  );

  const [
    estado,
    setEstado,
  ] = useState<EstadoIncidencia>(
    incidencia.estado,
  );

  const [
    guardando,
    setGuardando,
  ] = useState(false);

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
        !guardando &&
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
    guardando,
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

  const tituloValido =
    titulo.trim().length >
    0;

  const descripcionValida =
    descripcion.trim().length >
    0;

  const huboCambios =
    titulo.trim() !==
      incidencia.titulo ||
    descripcion.trim() !==
      incidencia.descripcion ||
    prioridad !==
      incidencia.prioridad ||
    estado !==
      incidencia.estado;

  const puedeGuardar =
    tituloValido &&
    descripcionValida &&
    huboCambios &&
    !guardando &&
    !eliminando;

  function cancelarEdicion() {
    setTitulo(
      incidencia.titulo,
    );

    setDescripcion(
      incidencia.descripcion,
    );

    setPrioridad(
      incidencia.prioridad,
    );

    setEstado(
      incidencia.estado,
    );

    setError(
      null,
    );

    setEditando(
      false,
    );
  }

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
      const actualizada =
        await actualizarIncidenciaPlano(
          incidencia.id_proyecto,
          incidencia.id_plano,
          incidencia.id_incidencia,
          {
            titulo:
              titulo.trim(),

            descripcion:
              descripcion.trim(),

            prioridad,

            estado,
          },
        );

      onActualizada(
        actualizada,
      );

      setEditando(
        false,
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
          'No fue posible actualizar la incidencia.',
        );
      }
    } finally {
      setGuardando(
        false,
      );
    }
  }

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
      await eliminarIncidenciaPlano(
        incidencia.id_proyecto,
        incidencia.id_plano,
        incidencia.id_incidencia,
      );

      onEliminada(
        incidencia.id_incidencia,
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
          'No fue posible eliminar la incidencia.',
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
      !guardando &&
      !eliminando
    ) {
      onCerrar();
    }
  }

  const prioridadClase =
    incidencia.prioridad ===
    'BAJA'
      ? styles.priorityLow
      : incidencia.prioridad ===
          'MEDIA'
        ? styles.priorityMedium
        : styles.priorityHigh;

  const estadoClase =
    incidencia.estado ===
    'PENDIENTE'
      ? styles.statusPending
      : incidencia.estado ===
          'EN_PROCESO'
        ? styles.statusProgress
        : styles.statusSolved;

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
        aria-labelledby="incident-detail-title"
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
            <div
              className={
                styles.titleRow
              }
            >
              <h2
                id="incident-detail-title"
              >
                {editando
                  ? 'Editar incidencia'
                  : incidencia.titulo}
              </h2>

              {!editando && (
                <>
                  <span
                    className={`${styles.badge} ${prioridadClase}`}
                  >
                    {formatearPrioridad(
                      incidencia.prioridad,
                    )}
                  </span>

                  <span
                    className={`${styles.badge} ${estadoClase}`}
                  >
                    {formatearEstado(
                      incidencia.estado,
                    )}
                  </span>
                </>
              )}
            </div>
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
              guardando ||
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
          {!editando ? (
            <>
              <div
                className={
                  styles.meta
                }
              >
                <div>
                  <span>
                    Página
                  </span>

                  <strong>
                    {
                      incidencia.numero_pagina
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Creada
                  </span>

                  <strong>
                    {formatearFecha(
                      incidencia.fecha_creacion,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Posición
                  </span>

                  <strong>
                    {(
                      incidencia.coordenada_x *
                      100
                    ).toFixed(
                      1,
                    )}
                    %
                    {' · '}
                    {(
                      incidencia.coordenada_y *
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
                  styles.description
                }
              >
                <span>
                  Descripción
                </span>

                <p>
                  {
                    incidencia.descripcion
                  }
                </p>
              </div>
            </>
          ) : (
            <>
              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="incident-edit-title"
                >
                  Título
                </label>

                <input
                  id="incident-edit-title"
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
                    guardando ||
                    eliminando
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
                  htmlFor="incident-edit-description"
                >
                  Descripción
                </label>

                <textarea
                  id="incident-edit-description"
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
                    guardando ||
                    eliminando
                  }
                  rows={
                    5
                  }
                />
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="incident-edit-priority"
                >
                  Prioridad
                </label>

                <select
                  id="incident-edit-priority"
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
                    guardando ||
                    eliminando
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

              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="incident-edit-status"
                >
                  Estado
                </label>

                <select
                  id="incident-edit-status"
                  value={
                    estado
                  }
                  onChange={(
                    event,
                  ) => {
                    setEstado(
                      event.target
                        .value as EstadoIncidencia,
                    );

                    setError(
                      null,
                    );
                  }}
                  disabled={
                    guardando ||
                    eliminando
                  }
                >
                  <option value="PENDIENTE">
                    Pendiente
                  </option>

                  <option value="EN_PROCESO">
                    En proceso
                  </option>

                  <option value="SOLUCIONADA">
                    Solucionada
                  </option>
                </select>
              </div>
            </>
          )}

          {confirmandoEliminacion && (
            <p
              className={
                styles.error
              }
            >
              ¿Seguro que quieres eliminar esta incidencia? Esta acción no se puede deshacer.
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
          <div
            className={
              styles.leftActions
            }
          >
            {!editando &&
              !confirmandoEliminacion && (
                <button
                  className={
                    styles.dangerButton
                  }
                  type="button"
                  onClick={() => {
                    setConfirmandoEliminacion(
                      true,
                    );

                    setError(
                      null,
                    );
                  }}
                  disabled={
                    guardando ||
                    eliminando
                  }
                >
                  Eliminar
                </button>
              )}

            {confirmandoEliminacion && (
              <>
                <button
                  className={
                    styles.button
                  }
                  type="button"
                  onClick={() => {
                    setConfirmandoEliminacion(
                      false,
                    );
                  }}
                  disabled={
                    eliminando
                  }
                >
                  Cancelar
                </button>

                <button
                  className={
                    styles.dangerButton
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
                    : 'Confirmar eliminación'}
                </button>
              </>
            )}
          </div>

          <div
            className={
              styles.rightActions
            }
          >
            {editando ? (
              <>
                <button
                  className={
                    styles.button
                  }
                  type="button"
                  onClick={
                    cancelarEdicion
                  }
                  disabled={
                    guardando ||
                    eliminando
                  }
                >
                  Cancelar
                </button>

                <button
                  className={
                    styles.primaryButton
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
              </>
            ) : !confirmandoEliminacion ? (
              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={() => {
                  setEditando(
                    true,
                  );

                  setError(
                    null,
                  );
                }}
              >
                Editar
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}