import {
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';

import { AutodeskCanvas } from './AutodeskCanvas';

import type {
  PlanoProyecto,
} from '../../types/plano';

import {
  listarIncidenciasPlano,
} from '../../api/incidencias.api';

import type {
  IncidenciaPlano,
} from '../../types/incidencia';

import {
  ApiError,
} from '../../../../shared/api/http';

import {
  CreateIncidentModal,
} from '../CreateIncidentModal/CreateIncidentModal';

import {
  IncidentDetailModal,
} from '../IncidentDetailModal/IncidentDetailModal';

import styles from './PlanViewer.module.css';

interface PlanViewerProps {
  plano: PlanoProyecto;

  incidenciaInicialId?:
  string | null;

  onCerrar: () => void;
}

interface PosicionNuevaIncidencia {
  numeroPagina: number;
  coordenadaX: number;
  coordenadaY: number;
}

export function PlanViewer({
  plano,
  incidenciaInicialId = null,
  onCerrar: cerrarVisor,
}: PlanViewerProps) {
  const [
    numeroPaginas,
    setNumeroPaginas,
  ] = useState(0);

  const [
    paginaActual,
    setPaginaActual,
  ] = useState(1);

  const [midiendo, setMidiendo] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [revisionIncidencias, setRevisionIncidencias] = useState(0);
  const [
    incidencias,
    setIncidencias,
  ] = useState<
    IncidenciaPlano[]
  >([]);

  const [
    modoCrearIncidencia,
    setModoCrearIncidencia,
  ] = useState(false);

  const [
    posicionNuevaIncidencia,
    setPosicionNuevaIncidencia,
  ] = useState<
    PosicionNuevaIncidencia | null
  >(null);

  const [
    incidenciaSeleccionada,
    setIncidenciaSeleccionada,
  ] = useState<
    IncidenciaPlano | null
  >(null);

  const incidenciaInicialAplicadaRef =
    useRef<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const puedeAnterior =
    paginaActual > 1;

  const puedeSiguiente =
    numeroPaginas > 0 &&
    paginaActual < numeroPaginas;

  const textoPagina =
    numeroPaginas > 0
      ? `${paginaActual} de ${numeroPaginas}`
      : 'Cargando...';

  const onCerrar = useCallback(() => {
    if (pendiente) { setError('Hay mediciones sin guardar. Espera el guardado o resuelve el aviso de sincronización.'); return; }
    cerrarVisor();
  }, [cerrarVisor, pendiente]);

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key !==
        'Escape'
      ) {
        return;
      }

      /*
       * Los modales internos gestionan
       * su propio Escape.
       */
      if (
        midiendo || posicionNuevaIncidencia ||
        incidenciaSeleccionada
      ) {
        return;
      }

      if (
        modoCrearIncidencia
      ) {
        setModoCrearIncidencia(
          false,
        );

        return;
      }

      onCerrar();
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
    midiendo,
    incidenciaSeleccionada,
    modoCrearIncidencia,
    onCerrar,
    posicionNuevaIncidencia,
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

  useEffect(() => {
    let activa =
      true;

    async function cargarIncidencias() {


      setError(
        null,
      );

      try {
        const respuesta =
          await listarIncidenciasPlano(
            plano.id_proyecto,
            plano.id_plano,
            {
              numeroPagina:
                paginaActual,

              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activa
        ) {
          return;
        }

        setIncidencias(
          respuesta.incidencias,
        );
      } catch (
      errorObtenido
      ) {
        if (
          !activa
        ) {
          return;
        }

        if (
          errorObtenido instanceof
          ApiError
        ) {
          setError(
            errorObtenido.message,
          );
        } else {
          setError(
            'No fue posible cargar las incidencias del plano.',
          );
        }

        setIncidencias(
          [],
        );
      }
    }

    if (
      numeroPaginas > 0
    ) {
      void cargarIncidencias();
    }

    return () => {
      activa =
        false;
    };
  }, [
    revisionIncidencias,
    numeroPaginas,
    paginaActual,
    plano.id_plano,
    plano.id_proyecto,
  ]);

  /*
   * Al cambiar de página cancelamos
   * cualquier selección temporal.
   */
  useEffect(() => {
    setModoCrearIncidencia(
      false,
    );

    setPosicionNuevaIncidencia(
      null,
    );

    setIncidenciaSeleccionada(
      null,
    );
  }, [
    paginaActual,
  ]);

  useEffect(() => {
    if (
      !incidenciaInicialId ||
      numeroPaginas <= 0 ||
      incidenciaInicialAplicadaRef.current ===
      incidenciaInicialId
    ) {
      return;
    }

    let activa =
      true;

    async function buscarIncidenciaInicial() {
      try {
        for (
          let numeroPagina = 1;
          numeroPagina <= numeroPaginas;
          numeroPagina += 1
        ) {
          const respuesta =
            await listarIncidenciasPlano(
              plano.id_proyecto,
              plano.id_plano,
              {
                numeroPagina,

                pagina:
                  1,

                limite:
                  100,
              },
            );

          if (
            !activa
          ) {
            return;
          }

          const incidencia =
            respuesta.incidencias.find(
              (
                item,
              ) =>
                item.id_incidencia ===
                incidenciaInicialId,
            );

          if (
            !incidencia
          ) {
            continue;
          }

          if (
            paginaActual !==
            incidencia.numero_pagina
          ) {
            setPaginaActual(
              incidencia.numero_pagina,
            );

            return;
          }

          incidenciaInicialAplicadaRef.current =
            incidenciaInicialId;

          setIncidenciaSeleccionada(
            incidencia,
          );

          return;
        }
      } catch (
      errorObtenido
      ) {
        console.error(
          'No fue posible localizar la incidencia de la notificación.',
          errorObtenido,
        );
      }
    }

    void buscarIncidenciaInicial();

    return () => {
      activa =
        false;
    };
  }, [
    incidenciaInicialId,
    numeroPaginas,
    paginaActual,
    plano.id_plano,
    plano.id_proyecto,
  ]);

  function cerrarDesdeFondo(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
  ) {
    if (
      event.target !==
      event.currentTarget
    ) {
      return;
    }

    if (
      posicionNuevaIncidencia ||
      incidenciaSeleccionada
    ) {
      return;
    }

    onCerrar();
  }

  function paginaAnterior() {
    if (
      !puedeAnterior || pendiente
    ) {
      return;
    }

    setPaginaActual(
      (
        actual,
      ) =>
        actual - 1,
    );
  }

  function paginaSiguiente() {
    if (
      !puedeSiguiente || pendiente
    ) {
      return;
    }

    setPaginaActual(
      (
        actual,
      ) =>
        actual + 1,
    );
  }

  function incidenciaCreada(
    nuevaIncidencia:
      IncidenciaPlano,
  ) {
    /*
     * Solo añadimos al listado visible
     * si pertenece a la página actual.
     */
    if (
      nuevaIncidencia.numero_pagina ===
      paginaActual
    ) {
      setIncidencias(
        (
          actuales,
        ) => [
            ...actuales,
            nuevaIncidencia,
          ],
      );
    }

    setPosicionNuevaIncidencia(
      null,
    );

    setError(
      null,
    );
  }

  function incidenciaActualizada(
    incidenciaActualizada:
      IncidenciaPlano,
  ) {
    setIncidencias(
      (
        actuales,
      ) =>
        actuales.map(
          (
            incidencia,
          ) =>
            incidencia.id_incidencia ===
              incidenciaActualizada.id_incidencia
              ? incidenciaActualizada
              : incidencia,
        ),
    );

    setIncidenciaSeleccionada(
      incidenciaActualizada,
    );

    setError(
      null,
    );
  }

  function incidenciaEliminada(
    idIncidencia: string,
  ) {
    setIncidencias(
      (
        actuales,
      ) =>
        actuales.filter(
          (
            incidencia,
          ) =>
            incidencia.id_incidencia !==
            idIncidencia,
        ),
    );

    setIncidenciaSeleccionada(
      null,
    );

    setError(
      null,
    );
  }


  return (
    <>
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
            styles.viewer
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-viewer-title"
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
              <strong
                id="plan-viewer-title"
              >
                {plano.titulo}
              </strong>

              <span>
                Plano · Autodesk Viewer
              </span>
            </div>

            <div
              className={
                styles.actions
              }
            >
              <button
                className={`${styles.incidentModeButton} ${modoCrearIncidencia
                  ? styles.incidentModeButtonActive
                  : ''
                  }`}
                type="button"
                onClick={() => {
                  setModoCrearIncidencia(
                    (
                      actual,
                    ) =>
                      !actual,
                  );

                  setIncidenciaSeleccionada(
                    null,
                  );

                  setPosicionNuevaIncidencia(
                    null,
                  );
                }}
                aria-pressed={
                  modoCrearIncidencia
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>

                <span>
                  {modoCrearIncidencia
                    ? 'Selecciona un punto'
                    : 'Nueva incidencia'}
                </span>
              </button>

              <div
                className={
                  styles.pageControls
                }
              >
                <button
                  className={
                    styles.controlButton
                  }
                  type="button"
                  onClick={
                    paginaAnterior
                  }
                  disabled={
                    !puedeAnterior
                  }
                  aria-label="Página anterior"
                >
                  ‹
                </button>

                <span
                  className={
                    styles.pageIndicator
                  }
                >
                  {textoPagina}
                </span>

                <button
                  className={
                    styles.controlButton
                  }
                  type="button"
                  onClick={
                    paginaSiguiente
                  }
                  disabled={
                    !puedeSiguiente
                  }
                  aria-label="Página siguiente"
                >
                  ›
                </button>
              </div>

              <a
                className={
                  styles.actionButton
                }
                href={
                  plano.url
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M14 3h7v7" />
                  <path d="m10 14 11-11" />
                  <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                </svg>

                <span>
                  Abrir
                </span>
              </a>

              <button
                className={
                  styles.closeButton
                }
                type="button"
                onClick={
                  onCerrar
                }
                aria-label="Cerrar visor"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div
            className={
              styles.content
            }
          >
            {error && (
              <div
                className={
                  styles.errorBanner
                }
                role="alert"
              >
                {error}
              </div>
            )}

            <AutodeskCanvas
              key={plano.id_plano + ':' + paginaActual}
              plano={plano} pagina={paginaActual} incidencias={incidencias}
              crearIncidencia={modoCrearIncidencia}
              onPaginas={setNumeroPaginas}
              onPendiente={setPendiente}
              onActualizarIncidencias={() => setRevisionIncidencias(v => v + 1)}
              onMedir={activo => { setMidiendo(activo); if (activo) setModoCrearIncidencia(false); }}
              onPunto={(x, y) => {
                setPosicionNuevaIncidencia({numeroPagina: paginaActual, coordenadaX: x, coordenadaY: y});
                setModoCrearIncidencia(false);
              }}
              onSeleccionar={incidencia => {
                setModoCrearIncidencia(false); setPosicionNuevaIncidencia(null);
                setIncidenciaSeleccionada(incidencia);
              }}
            />
          </div>
        </section>
      </div>

      {posicionNuevaIncidencia && (
        <CreateIncidentModal
          idProyecto={
            plano.id_proyecto
          }
          idPlano={
            plano.id_plano
          }
          numeroPagina={
            posicionNuevaIncidencia.numeroPagina
          }
          coordenadaX={
            posicionNuevaIncidencia.coordenadaX
          }
          coordenadaY={
            posicionNuevaIncidencia.coordenadaY
          }
          onCerrar={() => {
            setPosicionNuevaIncidencia(
              null,
            );
          }}
          onCreada={
            incidenciaCreada
          }
        />
      )}

      {incidenciaSeleccionada && (
        <IncidentDetailModal
          incidencia={
            incidenciaSeleccionada
          }
          onCerrar={() => {
            setIncidenciaSeleccionada(
              null,
            );
          }}
          onActualizada={
            incidenciaActualizada
          }
          onEliminada={
            incidenciaEliminada
          }
        />
      )}
    </>
  );
}