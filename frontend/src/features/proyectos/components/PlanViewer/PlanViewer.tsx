import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Document,
  Page,
  pdfjs,
} from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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

pdfjs.GlobalWorkerOptions.workerSrc =
  new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

interface PlanViewerProps {
  plano: PlanoProyecto;

  onCerrar: () => void;
}

interface PosicionNuevaIncidencia {
  numeroPagina: number;
  coordenadaX: number;
  coordenadaY: number;
}

export function PlanViewer({
  plano,
  onCerrar,
}: PlanViewerProps) {
  const [
    numeroPaginas,
    setNumeroPaginas,
  ] = useState(0);

  const [
    paginaActual,
    setPaginaActual,
  ] = useState(1);

  const [
    escala,
    setEscala,
  ] = useState(1);

  const [
    cargandoDocumento,
    setCargandoDocumento,
  ] = useState(true);

  const [
    cargandoIncidencias,
    setCargandoIncidencias,
  ] = useState(false);

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

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const escalaMinima =
    0.6;

  const escalaMaxima =
    2;

  const incrementoEscala =
    0.2;

  const puedeAnterior =
    paginaActual > 1;

  const puedeSiguiente =
    numeroPaginas > 0 &&
    paginaActual < numeroPaginas;

  const textoPagina =
    numeroPaginas > 0
      ? `${paginaActual} de ${numeroPaginas}`
      : 'Cargando...';

  const escalaPorcentaje =
    useMemo(
      () =>
        Math.round(
          escala * 100,
        ),
      [
        escala,
      ],
    );

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
        posicionNuevaIncidencia ||
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
      setCargandoIncidencias(
        true,
      );

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
      } finally {
        if (
          activa
        ) {
          setCargandoIncidencias(
            false,
          );
        }
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
      !puedeAnterior
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
      !puedeSiguiente
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

  function disminuirZoom() {
    setEscala(
      (
        actual,
      ) =>
        Math.max(
          escalaMinima,
          Number(
            (
              actual -
              incrementoEscala
            ).toFixed(
              1,
            ),
          ),
        ),
    );
  }

  function aumentarZoom() {
    setEscala(
      (
        actual,
      ) =>
        Math.min(
          escalaMaxima,
          Number(
            (
              actual +
              incrementoEscala
            ).toFixed(
              1,
            ),
          ),
        ),
    );
  }

  function seleccionarPuntoIncidencia(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
  ) {
    if (
      !modoCrearIncidencia
    ) {
      return;
    }

    const rect =
      event.currentTarget
        .getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }

    const coordenadaX =
      (event.clientX -
        rect.left) /
      rect.width;

    const coordenadaY =
      (event.clientY -
        rect.top) /
      rect.height;

    const xNormalizada =
      Math.min(
        1,
        Math.max(
          0,
          coordenadaX,
        ),
      );

    const yNormalizada =
      Math.min(
        1,
        Math.max(
          0,
          coordenadaY,
        ),
      );

    setPosicionNuevaIncidencia({
      numeroPagina:
        paginaActual,

      coordenadaX:
        xNormalizada,

      coordenadaY:
        yNormalizada,
    });

    setModoCrearIncidencia(
      false,
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

  function obtenerClaseMarcador(
    _incidencia:
      IncidenciaPlano,
  ): string {
    /*
     * De momento todos conservan
     * el estilo base.
     *
     * En el siguiente paso podemos
     * diferenciar color según estado
     * o prioridad.
     */
    return styles.incidentMarker;
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
                Documento PDF
              </span>
            </div>

            <div
              className={
                styles.actions
              }
            >
              <button
                className={`${styles.incidentModeButton} ${
                  modoCrearIncidencia
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

              <div
                className={
                  styles.zoomControls
                }
              >
                <button
                  className={
                    styles.controlButton
                  }
                  type="button"
                  onClick={
                    disminuirZoom
                  }
                  disabled={
                    escala <=
                    escalaMinima
                  }
                  aria-label="Alejar"
                >
                  −
                </button>

                <span
                  className={
                    styles.zoomValue
                  }
                >
                  {
                    escalaPorcentaje
                  }
                  %
                </span>

                <button
                  className={
                    styles.controlButton
                  }
                  type="button"
                  onClick={
                    aumentarZoom
                  }
                  disabled={
                    escala >=
                    escalaMaxima
                  }
                  aria-label="Acercar"
                >
                  +
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

            <div
              className={
                styles.pdfScroll
              }
            >
              <Document
                file={
                  plano.url
                }
                loading={
                  <div
                    className={
                      styles.loading
                    }
                  >
                    <div
                      className={
                        styles.spinner
                      }
                    />

                    <span>
                      Cargando plano...
                    </span>
                  </div>
                }
                error={
                  <div
                    className={
                      styles.error
                    }
                  >
                    <strong>
                      No fue posible mostrar el PDF
                    </strong>

                    <span>
                      Intenta abrir el documento en una pestaña nueva.
                    </span>
                  </div>
                }
                onLoadSuccess={({
                  numPages,
                }) => {
                  setNumeroPaginas(
                    numPages,
                  );

                  setPaginaActual(
                    (
                      actual,
                    ) =>
                      Math.min(
                        Math.max(
                          actual,
                          1,
                        ),
                        numPages,
                      ),
                  );

                  setCargandoDocumento(
                    false,
                  );

                  setError(
                    null,
                  );
                }}
                onLoadError={() => {
                  setCargandoDocumento(
                    false,
                  );

                  setError(
                    'No fue posible cargar el PDF.',
                  );
                }}
              >
                <div
                  className={`${styles.pageStage} ${
                    modoCrearIncidencia
                      ? styles.pageStageSelecting
                      : ''
                  }`}
                  onClick={
                    seleccionarPuntoIncidencia
                  }
                >
                  <Page
                    pageNumber={
                      paginaActual
                    }
                    scale={
                      escala
                    }
                    renderAnnotationLayer={
                      false
                    }
                    renderTextLayer={
                      false
                    }
                  />

                  {!cargandoDocumento &&
                    incidencias.map(
                      (
                        incidencia,
                      ) => (
                        <button
                          key={
                            incidencia.id_incidencia
                          }
                          className={
                            obtenerClaseMarcador(
                              incidencia,
                            )
                          }
                          type="button"
                          style={{
                            left:
                              `${incidencia.coordenada_x * 100}%`,

                            top:
                              `${incidencia.coordenada_y * 100}%`,
                          }}
                          title={
                            incidencia.titulo
                          }
                          aria-label={`Incidencia: ${incidencia.titulo}`}
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();

                            setModoCrearIncidencia(
                              false,
                            );

                            setPosicionNuevaIncidencia(
                              null,
                            );

                            setIncidenciaSeleccionada(
                              incidencia,
                            );
                          }}
                        >
                          !
                        </button>
                      ),
                    )}

                  {cargandoIncidencias && (
                    <div
                      className={
                        styles.incidentLoading
                      }
                    >
                      Cargando incidencias...
                    </div>
                  )}
                </div>
              </Document>
            </div>
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