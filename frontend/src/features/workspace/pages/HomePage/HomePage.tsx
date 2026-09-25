import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useProyectos } from '../../../proyectos/hooks/useProyectos';
import { ProjectsMap } from '../../../proyectos/components/ProjectsMap/ProjectsMap';

import styles from './HomePage.module.css';

type FiltroEstado =
  | 'TODOS'
  | 'ACTIVA'
  | 'PAUSA'
  | 'FINALIZADA';

type VistaProyectos =
  | 'tarjetas'
  | 'lista';

function formatearEstado(
  estado: 'ACTIVA' | 'PAUSA' | 'FINALIZADA',
): string {
  if (estado === 'ACTIVA') {
    return 'Activa';
  }

  if (estado === 'PAUSA') {
    return 'En pausa';
  }

  return 'Finalizada';
}

function obtenerIniciales(
  nombre: string | null,
  apellidos: string | null,
): string {
  const partes = [
    nombre,
    apellidos,
  ]
    .filter(
      (valor): valor is string =>
        Boolean(valor?.trim()),
    )
    .map((valor) =>
      valor.trim(),
    );

  if (partes.length === 0) {
    return 'U';
  }

  if (partes.length === 1) {
    return partes[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    partes[0][0] +
    partes[1][0]
  ).toUpperCase();
}

function obtenerNombreParticipante(
  nombre: string | null,
  apellidos: string | null,
): string {
  const nombreCompleto = [
    nombre,
    apellidos,
  ]
    .filter(
      (valor): valor is string =>
        Boolean(valor?.trim()),
    )
    .join(' ')
    .trim();

  return nombreCompleto || 'Usuario';
}

function formatearUltimaActualizacion(
  fecha: string | null,
): {
  fecha: string;
  hora: string | null;
} {
  if (!fecha) {
    return {
      fecha: 'Sin actividad',
      hora: null,
    };
  }

  const valor =
    new Date(fecha);

  if (
    Number.isNaN(
      valor.getTime(),
    )
  ) {
    return {
      fecha: 'Sin actividad',
      hora: null,
    };
  }

  return {
    fecha:
      new Intl.DateTimeFormat(
        'es-CO',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        },
      ).format(valor),

    hora:
      new Intl.DateTimeFormat(
        'es-CO',
        {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        },
      ).format(valor),
  };
}

export function HomePage() {
  const [
    busqueda,
    setBusqueda,
  ] = useState('');

  const [
    busquedaAplicada,
    setBusquedaAplicada,
  ] = useState('');

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState<FiltroEstado>(
    'TODOS',
  );

  const [
    mostrandoFiltros,
    setMostrandoFiltros,
  ] = useState(false);

  const [
    pagina,
    setPagina,
  ] = useState(1);

  const [
    proyectoSeleccionadoId,
    setProyectoSeleccionadoId,
  ] = useState<
    string | null
  >(null);

  const [
    mapaAmpliado,
    setMapaAmpliado,
  ] = useState(false);

  const [
    vistaProyectos,
    setVistaProyectos,
  ] = useState<VistaProyectos>(
    'lista',
  );

  const limite = 20;

  const {
    cargando,
    proyectos,
    total,
    totalPaginas,
    error,
    recargar,
  } = useProyectos(
    pagina,
    limite,
    busquedaAplicada,
  );

  useEffect(() => {
    const temporizador =
      window.setTimeout(() => {
        const nuevaBusqueda =
          busqueda.trim();

        setPagina(1);

        setProyectoSeleccionadoId(
          null,
        );

        setBusquedaAplicada(
          nuevaBusqueda,
        );
      }, 250);

    return () => {
      window.clearTimeout(
        temporizador,
      );
    };
  }, [
    busqueda,
  ]);

  useEffect(() => {
    if (
      totalPaginas > 0 &&
      pagina > totalPaginas
    ) {
      setPagina(
        totalPaginas,
      );
    }
  }, [
    pagina,
    totalPaginas,
  ]);

  useEffect(() => {
    setProyectoSeleccionadoId(
      null,
    );
  }, [
    pagina,
  ]);

  useEffect(() => {
    if (!mapaAmpliado) {
      return;
    }

    function cerrarConEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape'
      ) {
        setMapaAmpliado(false);
      }
    }

    document.addEventListener(
      'keydown',
      cerrarConEscape,
    );

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.removeEventListener(
        'keydown',
        cerrarConEscape,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    mapaAmpliado,
  ]);

  const proyectosFiltrados =
    useMemo(() => {
      return proyectos.filter(
        (proyecto) => {
          if (
            filtroEstado ===
            'TODOS'
          ) {
            return true;
          }

          return (
            proyecto.estado_proyecto ===
            filtroEstado
          );
        },
      );
    }, [
      filtroEstado,
      proyectos,
    ]);

  const proyectosConUbicacion =
    useMemo(
      () =>
        proyectosFiltrados.filter(
          (proyecto) =>
            proyecto.latitud !==
              null &&
            proyecto.longitud !==
              null,
        ),
      [
        proyectosFiltrados,
      ],
    );

  const hayFiltrosActivos =
    filtroEstado !==
    'TODOS';

  const desde =
    total === 0
      ? 0
      : (pagina - 1) *
          limite +
        1;

  const hasta =
    Math.min(
      pagina * limite,
      total,
    );

  function paginaAnterior() {
    setPagina(
      (paginaActual) =>
        Math.max(
          1,
          paginaActual - 1,
        ),
    );
  }

  function paginaSiguiente() {
    setPagina(
      (paginaActual) =>
        Math.min(
          totalPaginas,
          paginaActual + 1,
        ),
    );
  }

  function limpiarFiltros() {
    setFiltroEstado(
      'TODOS',
    );
  }

  return (
    <section
      className={styles.page}
    >
      <header
        className={
          styles.pageHeader
        }
      >
        <div>
          <h1
            className={
              styles.title
            }
          >
            Inicio
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            Resumen general de tus
            proyectos.
          </p>
        </div>

        <div
          className={
            styles.actions
          }
        >
          <label
            className={
              styles.searchBox
            }
          >
            <span
              className={
                styles.srOnly
              }
            >
              Buscar proyecto
            </span>

            <input
              type="search"
              placeholder="Buscar proyecto..."
              className={
                styles.searchInput
              }
              value={busqueda}
              onChange={(
                event,
              ) => {
                setBusqueda(
                  event.target.value,
                );

                setProyectoSeleccionadoId(
                  null,
                );
              }}
            />

            <svg
              className={
                styles.searchIcon
              }
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path d="m20 20-4-4" />
            </svg>
          </label>

          <button
            className={`${styles.filterButton} ${
              mostrandoFiltros ||
              hayFiltrosActivos
                ? styles.filterButtonActive
                : ''
            }`}
            type="button"
            onClick={() => {
              setMostrandoFiltros(
                (
                  valorActual,
                ) =>
                  !valorActual,
              );
            }}
            aria-expanded={
              mostrandoFiltros
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M4 5h16" />
              <path d="M7 12h10" />
              <path d="M10 19h4" />
            </svg>

            <span>
              Filtros
            </span>

            {hayFiltrosActivos && (
              <span
                className={
                  styles.filterIndicator
                }
                aria-label="Hay filtros activos"
              />
            )}
          </button>
        </div>
      </header>

      {mostrandoFiltros && (
        <section
          className={
            styles.filtersPanel
          }
          aria-label="Filtros de proyectos"
        >
          <div
            className={
              styles.filterGroup
            }
          >
            <span
              className={
                styles.filterLabel
              }
            >
              Estado del proyecto
            </span>

            <div
              className={
                styles.filterOptions
              }
            >
              {(
                [
                  [
                    'TODOS',
                    'Todos',
                  ],
                  [
                    'ACTIVA',
                    'Activas',
                  ],
                  [
                    'PAUSA',
                    'En pausa',
                  ],
                  [
                    'FINALIZADA',
                    'Finalizadas',
                  ],
                ] as const
              ).map(
                ([
                  valor,
                  etiqueta,
                ]) => (
                  <button
                    key={valor}
                    className={`${styles.filterOption} ${
                      filtroEstado ===
                      valor
                        ? styles.filterOptionActive
                        : ''
                    }`}
                    type="button"
                    onClick={() => {
                      setFiltroEstado(
                        valor,
                      );

                      setProyectoSeleccionadoId(
                        null,
                      );
                    }}
                  >
                    {
                      etiqueta
                    }
                  </button>
                ),
              )}
            </div>
          </div>

          {hayFiltrosActivos && (
            <button
              className={
                styles.clearFiltersButton
              }
              type="button"
              onClick={() => {
                limpiarFiltros();

                setProyectoSeleccionadoId(
                  null,
                );
              }}
            >
              Limpiar filtros
            </button>
          )}
        </section>
      )}

      <div
        className={
          styles.dashboardGrid
        }
      >
        <article
          className={
            styles.panel
          }
        >
          <header
            className={
              styles.panelHeader
            }
          >
            <div
              className={
                styles.panelTitle
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />

                <circle
                  cx="12"
                  cy="10"
                  r="2"
                />
              </svg>

              <div>
                <h2>
                  Mapa de proyectos
                </h2>

                <span
                  className={
                    styles.panelMeta
                  }
                >
                  {
                    proyectosConUbicacion.length
                  }{' '}
                  con ubicación
                </span>
              </div>
            </div>

            <button
              className={
                styles.iconButton
              }
              type="button"
              aria-label="Ampliar mapa"
              onClick={() => {
                setMapaAmpliado(
                  true,
                );
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 3H3v5" />
                <path d="M16 3h5v5" />
                <path d="M8 21H3v-5" />
                <path d="M16 21h5v-5" />
              </svg>
            </button>
          </header>

          <div
            className={
              styles.mapContainer
            }
          >
            <ProjectsMap
              proyectos={
                proyectosConUbicacion
              }
              proyectoSeleccionadoId={
                proyectoSeleccionadoId
              }
            />
          </div>
        </article>

        <article
          className={
            styles.panel
          }
        >
          <header
            className={
              styles.panelHeader
            }
          >
            <div
              className={
                styles.panelTitle
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 6h13" />
                <path d="M8 12h13" />
                <path d="M8 18h13" />
                <path d="M3 6h.01" />
                <path d="M3 12h.01" />
                <path d="M3 18h.01" />
              </svg>

              <div>
                <h2>
                  Lista de proyectos
                </h2>

                <span
                  className={
                    styles.panelMeta
                  }
                >
                  {total}{' '}
                  {total === 1
                    ? 'proyecto'
                    : 'proyectos'}
                </span>
              </div>
            </div>

            <div
              className={
                styles.viewButtons
              }
            >
              <button
                className={`${styles.iconButton} ${
                  vistaProyectos ===
                  'tarjetas'
                    ? styles.iconButtonActive
                    : ''
                }`}
                type="button"
                aria-label="Vista de tarjetas"
                aria-pressed={
                  vistaProyectos ===
                  'tarjetas'
                }
                onClick={() => {
                  setVistaProyectos(
                    'tarjetas',
                  );
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                  />

                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                  />

                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                  />

                  <rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                  />
                </svg>
              </button>

              <button
                className={`${styles.iconButton} ${
                  vistaProyectos ===
                  'lista'
                    ? styles.iconButtonActive
                    : ''
                }`}
                type="button"
                aria-label="Vista de lista"
                aria-pressed={
                  vistaProyectos ===
                  'lista'
                }
                onClick={() => {
                  setVistaProyectos(
                    'lista',
                  );
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 6h13" />
                  <path d="M8 12h13" />
                  <path d="M8 18h13" />
                  <path d="M3 6h.01" />
                  <path d="M3 12h.01" />
                  <path d="M3 18h.01" />
                </svg>
              </button>
            </div>
          </header>

          <div
            className={
              styles.projectListPlaceholder
            }
          >
            {vistaProyectos ===
              'lista' && (
              <div
                className={
                  styles.tableHeader
                }
              >
                <span>
                  Proyecto
                </span>

                <span>
                  Ubicación
                </span>

                <span>
                  Estado
                </span>

                <span>
                  Equipo
                </span>

                <span>
                  Última actualización
                </span>
              </div>
            )}

            {cargando && (
              <div
                className={
                  styles.emptyState
                }
                role="status"
              >
                <div
                  className={
                    styles.loadingSpinner
                  }
                  aria-hidden="true"
                />

                <h3>
                  Cargando proyectos
                </h3>

                <p>
                  Estamos consultando
                  la información del
                  servidor.
                </p>
              </div>
            )}

            {!cargando &&
              error && (
                <div
                  className={
                    styles.errorState
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                    />

                    <path d="M12 7v6" />
                    <path d="M12 17h.01" />
                  </svg>

                  <h3>
                    No pudimos cargar
                    los proyectos
                  </h3>

                  <p>
                    {error}
                  </p>

                  <button
                    className={
                      styles.retryButton
                    }
                    type="button"
                    onClick={() => {
                      void recargar();
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}

            {!cargando &&
              !error &&
              proyectosFiltrados.length ===
                0 && (
                <div
                  className={
                    styles.emptyState
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M3 7.5h6l2-2h10v14H3z" />
                    <path d="M3 10h18" />
                  </svg>

                  <h3>
                    {busqueda.trim() ||
                    hayFiltrosActivos
                      ? 'No encontramos proyectos'
                      : 'Aún no tienes proyectos'}
                  </h3>

                  <p>
                    {busqueda.trim() ||
                    hayFiltrosActivos
                      ? 'Prueba cambiando la búsqueda o los filtros.'
                      : 'Cuando tengas proyectos disponibles aparecerán en esta lista.'}
                  </p>
                </div>
              )}

            {!cargando &&
              !error &&
              proyectosFiltrados.length >
                0 &&
              vistaProyectos ===
                'lista' && (
                <div
                  className={
                    styles.projectRows
                  }
                >
                  {proyectosFiltrados.map(
                    (proyecto) => {
                      const seleccionado =
                        proyecto.id_proyecto ===
                        proyectoSeleccionadoId;

                      const tieneUbicacion =
                        proyecto.latitud !==
                          null &&
                        proyecto.longitud !==
                          null;

                      const ultimaActualizacion =
                        formatearUltimaActualizacion(
                          proyecto.ultima_actualizacion,
                        );

                      const participantesVisibles =
                        proyecto.equipo.slice(
                          0,
                          3,
                        );

                      const participantesRestantes =
                        Math.max(
                          proyecto.equipo.length -
                            participantesVisibles.length,
                          0,
                        );

                      return (
                        <button
                          key={
                            proyecto.id_proyecto
                          }
                          className={`${styles.projectRow} ${
                            seleccionado
                              ? styles.projectRowSelected
                              : ''
                          }`}
                          type="button"
                          onClick={() => {
                            if (
                              !tieneUbicacion
                            ) {
                              setProyectoSeleccionadoId(
                                null,
                              );

                              return;
                            }

                            setProyectoSeleccionadoId(
                              proyecto.id_proyecto,
                            );
                          }}
                          aria-pressed={
                            seleccionado
                          }
                          title={
                            tieneUbicacion
                              ? 'Ver proyecto en el mapa'
                              : 'Este proyecto no tiene ubicación registrada'
                          }
                        >
                          <div
                            className={
                              styles.projectMain
                            }
                          >
                            <div
                              className={
                                styles.projectIcon
                              }
                              aria-hidden="true"
                            >
                              <svg
                                viewBox="0 0 24 24"
                              >
                                <path d="M3 7.5h6l2-2h10v14H3z" />
                                <path d="M3 10h18" />
                              </svg>
                            </div>

                            <div
                              className={
                                styles.projectText
                              }
                            >
                              <strong>
                                {
                                  proyecto.nombre
                                }
                              </strong>

                              <span>
                                {
                                  proyecto.contratante
                                }
                              </span>
                            </div>
                          </div>

                          <div
                            className={
                              styles.projectLocation
                            }
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />

                              <circle
                                cx="12"
                                cy="10"
                                r="2"
                              />
                            </svg>

                            <span>
                              {
                                proyecto.direccion
                              }
                            </span>
                          </div>

                          <div>
                            <span
                              className={`${styles.statusBadge} ${
                                proyecto.estado_proyecto ===
                                'ACTIVA'
                                  ? styles.statusActive
                                  : proyecto.estado_proyecto ===
                                      'PAUSA'
                                    ? styles.statusPaused
                                    : styles.statusFinished
                              }`}
                            >
                              {formatearEstado(
                                proyecto.estado_proyecto,
                              )}
                            </span>
                          </div>

                          <div
                            className={
                              styles.projectTeam
                            }
                            aria-label={`${proyecto.equipo.length} participantes`}
                          >
                            {participantesVisibles.length ===
                            0 ? (
                              <span
                                className={
                                  styles.noTeam
                                }
                              >
                                Sin equipo
                              </span>
                            ) : (
                              <div
                                className={
                                  styles.teamAvatars
                                }
                              >
                                {participantesVisibles.map(
                                  (
                                    participante,
                                  ) => {
                                    const nombreParticipante =
                                      obtenerNombreParticipante(
                                        participante.nombre,
                                        participante.apellidos,
                                      );

                                    return (
                                      <div
                                        key={
                                          participante.id_usuario
                                        }
                                        className={
                                          styles.teamAvatar
                                        }
                                        title={
                                          nombreParticipante
                                        }
                                      >
                                        {participante.foto_perfil_url ? (
                                          <img
                                            src={
                                              participante.foto_perfil_url
                                            }
                                            alt=""
                                          />
                                        ) : (
                                          <span>
                                            {obtenerIniciales(
                                              participante.nombre,
                                              participante.apellidos,
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  },
                                )}

                                {participantesRestantes >
                                  0 && (
                                  <div
                                    className={`${styles.teamAvatar} ${styles.teamAvatarMore}`}
                                    title={`${participantesRestantes} participantes más`}
                                  >
                                    +
                                    {
                                      participantesRestantes
                                    }
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div
                            className={
                              styles.lastUpdate
                            }
                          >
                            <strong>
                              {
                                ultimaActualizacion.fecha
                              }
                            </strong>

                            {ultimaActualizacion.hora && (
                              <span>
                                {
                                  ultimaActualizacion.hora
                                }
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

            {!cargando &&
              !error &&
              proyectosFiltrados.length >
                0 &&
              vistaProyectos ===
                'tarjetas' && (
                <div
                  className={
                    styles.projectCards
                  }
                >
                  {proyectosFiltrados.map(
                    (proyecto) => {
                      const seleccionado =
                        proyecto.id_proyecto ===
                        proyectoSeleccionadoId;

                      const tieneUbicacion =
                        proyecto.latitud !==
                          null &&
                        proyecto.longitud !==
                          null;

                      const ultimaActualizacion =
                        formatearUltimaActualizacion(
                          proyecto.ultima_actualizacion,
                        );

                      const participantesVisibles =
                        proyecto.equipo.slice(
                          0,
                          3,
                        );

                      const participantesRestantes =
                        Math.max(
                          proyecto.equipo.length -
                            participantesVisibles.length,
                          0,
                        );

                      return (
                        <button
                          key={
                            proyecto.id_proyecto
                          }
                          className={`${styles.projectCard} ${
                            seleccionado
                              ? styles.projectCardSelected
                              : ''
                          }`}
                          type="button"
                          aria-pressed={
                            seleccionado
                          }
                          title={
                            tieneUbicacion
                              ? 'Ver proyecto en el mapa'
                              : 'Este proyecto no tiene ubicación registrada'
                          }
                          onClick={() => {
                            if (
                              !tieneUbicacion
                            ) {
                              setProyectoSeleccionadoId(
                                null,
                              );

                              return;
                            }

                            setProyectoSeleccionadoId(
                              proyecto.id_proyecto,
                            );
                          }}
                        >
                          <div
                            className={
                              styles.projectCardHeader
                            }
                          >
                            <div
                              className={
                                styles.projectIcon
                              }
                              aria-hidden="true"
                            >
                              <svg
                                viewBox="0 0 24 24"
                              >
                                <path d="M3 7.5h6l2-2h10v14H3z" />
                                <path d="M3 10h18" />
                              </svg>
                            </div>

                            <span
                              className={`${styles.statusBadge} ${
                                proyecto.estado_proyecto ===
                                'ACTIVA'
                                  ? styles.statusActive
                                  : proyecto.estado_proyecto ===
                                      'PAUSA'
                                    ? styles.statusPaused
                                    : styles.statusFinished
                              }`}
                            >
                              {formatearEstado(
                                proyecto.estado_proyecto,
                              )}
                            </span>
                          </div>

                          <div
                            className={
                              styles.projectCardTitle
                            }
                          >
                            <strong>
                              {
                                proyecto.nombre
                              }
                            </strong>

                            <span>
                              {
                                proyecto.contratante
                              }
                            </span>
                          </div>

                          <div
                            className={
                              styles.projectCardLocation
                            }
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />

                              <circle
                                cx="12"
                                cy="10"
                                r="2"
                              />
                            </svg>

                            <span>
                              {
                                proyecto.direccion
                              }
                            </span>
                          </div>

                          <div
                            className={
                              styles.projectCardFooter
                            }
                          >
                            <div
                              className={
                                styles.projectTeam
                              }
                              aria-label={`${proyecto.equipo.length} participantes`}
                            >
                              {participantesVisibles.length ===
                              0 ? (
                                <span
                                  className={
                                    styles.noTeam
                                  }
                                >
                                  Sin equipo
                                </span>
                              ) : (
                                <div
                                  className={
                                    styles.teamAvatars
                                  }
                                >
                                  {participantesVisibles.map(
                                    (
                                      participante,
                                    ) => (
                                      <div
                                        key={
                                          participante.id_usuario
                                        }
                                        className={
                                          styles.teamAvatar
                                        }
                                        title={obtenerNombreParticipante(
                                          participante.nombre,
                                          participante.apellidos,
                                        )}
                                      >
                                        {participante.foto_perfil_url ? (
                                          <img
                                            src={
                                              participante.foto_perfil_url
                                            }
                                            alt=""
                                          />
                                        ) : (
                                          <span>
                                            {obtenerIniciales(
                                              participante.nombre,
                                              participante.apellidos,
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    ),
                                  )}

                                  {participantesRestantes >
                                    0 && (
                                    <div
                                      className={`${styles.teamAvatar} ${styles.teamAvatarMore}`}
                                      title={`${participantesRestantes} participantes más`}
                                    >
                                      +
                                      {
                                        participantesRestantes
                                      }
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div
                              className={
                                styles.lastUpdate
                              }
                            >
                              <strong>
                                {
                                  ultimaActualizacion.fecha
                                }
                              </strong>

                              {ultimaActualizacion.hora && (
                                <span>
                                  {
                                    ultimaActualizacion.hora
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}

            {!cargando &&
              !error &&
              totalPaginas >
                1 && (
                <footer
                  className={
                    styles.pagination
                  }
                >
                  <span
                    className={
                      styles.paginationInfo
                    }
                  >
                    Mostrando{' '}
                    {desde}–{hasta}{' '}
                    de {total}
                  </span>

                  <div
                    className={
                      styles.paginationControls
                    }
                  >
                    <button
                      className={
                        styles.paginationButton
                      }
                      type="button"
                      onClick={
                        paginaAnterior
                      }
                      disabled={
                        pagina <= 1
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>

                      <span>
                        Anterior
                      </span>
                    </button>

                    <span
                      className={
                        styles.currentPage
                      }
                    >
                      Página{' '}
                      {pagina} de{' '}
                      {totalPaginas}
                    </span>

                    <button
                      className={
                        styles.paginationButton
                      }
                      type="button"
                      onClick={
                        paginaSiguiente
                      }
                      disabled={
                        pagina >=
                        totalPaginas
                      }
                    >
                      <span>
                        Siguiente
                      </span>

                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </footer>
              )}
          </div>
        </article>
      </div>

      {mapaAmpliado && (
        <div
          className={
            styles.expandedMapBackdrop
          }
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setMapaAmpliado(
                false,
              );
            }
          }}
        >
          <section
            className={
              styles.expandedMap
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-map-title"
          >
            <header
              className={
                styles.expandedMapHeader
              }
            >
              <div
                className={
                  styles.expandedMapTitle
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />

                  <circle
                    cx="12"
                    cy="10"
                    r="2"
                  />
                </svg>

                <div>
                  <h2 id="expanded-map-title">
                    Mapa de proyectos
                  </h2>

                  <span>
                    {
                      proyectosConUbicacion.length
                    }{' '}
                    con ubicación
                  </span>
                </div>
              </div>

              <button
                className={
                  styles.expandedMapClose
                }
                type="button"
                aria-label="Cerrar mapa ampliado"
                onClick={() => {
                  setMapaAmpliado(
                    false,
                  );
                }}
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
                styles.expandedMapContent
              }
            >
              <ProjectsMap
                proyectos={
                  proyectosConUbicacion
                }
                proyectoSeleccionadoId={
                  proyectoSeleccionadoId
                }
              />
            </div>
          </section>
        </div>
      )}
    </section>
  );
}