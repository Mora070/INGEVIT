import {
  useMemo,
  useState,
} from 'react';

import {
  ProjectForm,
} from '../../components/ProjectForm/ProjectForm';

import {
  useProyectos,
} from '../../hooks/useProyectos';

import type {
  Proyecto,
} from '../../types/proyecto';

import styles from './ProjectsPage.module.css';

interface ProjectsPageProps {
  onAbrirProyecto: (
    idProyecto: string,
  ) => void;
}

function formatearEstado(
  estado:
    | 'ACTIVA'
    | 'PAUSA'
    | 'FINALIZADA',
): string {
  if (estado === 'ACTIVA') {
    return 'Activa';
  }

  if (estado === 'PAUSA') {
    return 'En pausa';
  }

  return 'Finalizada';
}

function formatearFecha(
  fecha: string | null,
): string {
  if (!fecha) {
    return 'Sin fecha';
  }

  const [
    anio,
    mes,
    dia,
  ] = fecha.split('-');

  if (
    !anio ||
    !mes ||
    !dia
  ) {
    return fecha;
  }

  return `${dia}/${mes}/${anio}`;
}

export function ProjectsPage({
  onAbrirProyecto,
}: ProjectsPageProps) {
  const [
    busqueda,
    setBusqueda,
  ] = useState('');

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState<
    | 'TODOS'
    | 'ACTIVA'
    | 'PAUSA'
    | 'FINALIZADA'
  >('TODOS');

  const [
    mostrandoFormulario,
    setMostrandoFormulario,
  ] = useState(false);

  const {
    cargando,
    proyectos,
    total,
    error,
    recargar,
  } = useProyectos(
    1,
    20,
  );

  const proyectosFiltrados =
    useMemo(() => {
      const termino =
        busqueda
          .trim()
          .toLowerCase();

      return proyectos.filter(
        (proyecto) => {
          const coincideEstado =
            filtroEstado ===
              'TODOS' ||
            proyecto.estado_proyecto ===
              filtroEstado;

          if (
            !coincideEstado
          ) {
            return false;
          }

          if (!termino) {
            return true;
          }

          const texto = [
            proyecto.nombre,
            proyecto.descripcion,
            proyecto.direccion,
            proyecto.contratante,
          ]
            .join(' ')
            .toLowerCase();

          return texto.includes(
            termino,
          );
        },
      );
    }, [
      busqueda,
      filtroEstado,
      proyectos,
    ]);

  function abrirFormulario() {
    setMostrandoFormulario(
      true,
    );
  }

  function cerrarFormulario() {
    setMostrandoFormulario(
      false,
    );
  }

  function proyectoCreado(
    _proyecto: Proyecto,
  ) {
    setMostrandoFormulario(
      false,
    );

    void recargar();
  }

  return (
    <>
      <section
        className={
          styles.page
        }
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
              Proyectos
            </h1>

            <p
              className={
                styles.subtitle
              }
            >
              Administra tus proyectos,
              ubicaciones y estado de
              avance.
            </p>
          </div>

          <button
            className={
              styles.createButton
            }
            type="button"
            onClick={
              abrirFormulario
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
              Nuevo proyecto
            </span>
          </button>
        </header>

        <section
          className={
            styles.toolbar
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
              className={
                styles.searchInput
              }
              type="search"
              placeholder="Buscar proyecto..."
              value={
                busqueda
              }
              onChange={(
                event,
              ) =>
                setBusqueda(
                  event.target.value,
                )
              }
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

          <div
            className={
              styles.filters
            }
          >
            <button
              className={`${styles.filterButton} ${
                filtroEstado ===
                'TODOS'
                  ? styles.filterButtonActive
                  : ''
              }`}
              type="button"
              onClick={() =>
                setFiltroEstado(
                  'TODOS',
                )
              }
            >
              Todos
            </button>

            <button
              className={`${styles.filterButton} ${
                filtroEstado ===
                'ACTIVA'
                  ? styles.filterButtonActive
                  : ''
              }`}
              type="button"
              onClick={() =>
                setFiltroEstado(
                  'ACTIVA',
                )
              }
            >
              Activos
            </button>

            <button
              className={`${styles.filterButton} ${
                filtroEstado ===
                'PAUSA'
                  ? styles.filterButtonActive
                  : ''
              }`}
              type="button"
              onClick={() =>
                setFiltroEstado(
                  'PAUSA',
                )
              }
            >
              En pausa
            </button>

            <button
              className={`${styles.filterButton} ${
                filtroEstado ===
                'FINALIZADA'
                  ? styles.filterButtonActive
                  : ''
              }`}
              type="button"
              onClick={() =>
                setFiltroEstado(
                  'FINALIZADA',
                )
              }
            >
              Finalizados
            </button>
          </div>
        </section>

        <section
          className={
            styles.projectsPanel
          }
        >
          <header
            className={
              styles.panelHeader
            }
          >
            <div>
              <h2>
                Mis proyectos
              </h2>

              <p>
                {total}{' '}
                {total === 1
                  ? 'proyecto disponible'
                  : 'proyectos disponibles'}
              </p>
            </div>
          </header>

          {cargando && (
            <div
              className={
                styles.state
              }
              role="status"
            >
              <div
                className={
                  styles.spinner
                }
                aria-hidden="true"
              />

              <h3>
                Cargando proyectos
              </h3>

              <p>
                Consultando la
                información del
                servidor.
              </p>
            </div>
          )}

          {!cargando &&
            error && (
              <div
                className={
                  styles.state
                }
              >
                <svg
                  className={
                    styles.stateIconError
                  }
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
                  styles.state
                }
              >
                <svg
                  className={
                    styles.stateIcon
                  }
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M3 7.5h6l2-2h10v14H3z" />
                  <path d="M3 10h18" />
                </svg>

                <h3>
                  {busqueda.trim() ||
                  filtroEstado !==
                    'TODOS'
                    ? 'No encontramos proyectos'
                    : 'Aún no tienes proyectos'}
                </h3>

                <p>
                  {busqueda.trim() ||
                  filtroEstado !==
                    'TODOS'
                    ? 'Prueba modificando la búsqueda o los filtros.'
                    : 'Crea tu primer proyecto para comenzar a gestionarlo desde INGEVIT.'}
                </p>

                {!busqueda.trim() &&
                  filtroEstado ===
                    'TODOS' && (
                    <button
                      className={
                        styles.emptyCreateButton
                      }
                      type="button"
                      onClick={
                        abrirFormulario
                      }
                    >
                      Crear primer
                      proyecto
                    </button>
                  )}
              </div>
            )}

          {!cargando &&
            !error &&
            proyectosFiltrados.length >
              0 && (
              <div
                className={
                  styles.projectGrid
                }
              >
                {proyectosFiltrados.map(
                  (proyecto) => (
                    <article
                      key={
                        proyecto.id_proyecto
                      }
                      className={
                        styles.projectCard
                      }
                      onDoubleClick={() => {
                        onAbrirProyecto(
                          proyecto.id_proyecto,
                        );
                      }}
                      title="Doble clic para abrir el proyecto"
                    >
                      <header
                        className={
                          styles.cardHeader
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
                      </header>

                      <div
                        className={
                          styles.cardContent
                        }
                      >
                        <h3>
                          {
                            proyecto.nombre
                          }
                        </h3>

                        <p
                          className={
                            styles.description
                          }
                        >
                          {
                            proyecto.descripcion
                          }
                        </p>

                        <dl
                          className={
                            styles.projectData
                          }
                        >
                          <div>
                            <dt>
                              Contratante
                            </dt>

                            <dd>
                              {
                                proyecto.contratante
                              }
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Dirección
                            </dt>

                            <dd>
                              {
                                proyecto.direccion
                              }
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Inicio
                            </dt>

                            <dd>
                              {formatearFecha(
                                proyecto.fecha_inicio,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>
                              Finalización
                            </dt>

                            <dd>
                              {formatearFecha(
                                proyecto.fecha_finalizacion,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <footer
                        className={
                          styles.cardFooter
                        }
                      >
                        <div
                          className={
                            styles.locationStatus
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
                            {proyecto.latitud !==
                              null &&
                            proyecto.longitud !==
                              null
                              ? 'Ubicación configurada'
                              : 'Sin coordenadas'}
                          </span>
                        </div>

                        <button
                          className={
                            styles.openButton
                          }
                          type="button"
                          onClick={() => {
                            onAbrirProyecto(
                              proyecto.id_proyecto,
                            );
                          }}
                        >
                          Ver proyecto

                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </footer>
                    </article>
                  ),
                )}
              </div>
            )}
        </section>
      </section>

      {mostrandoFormulario && (
        <div
          className={
            styles.modalBackdrop
          }
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarFormulario();
            }
          }}
        >
          <section
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
          >
            <header
              className={
                styles.modalHeader
              }
            >
              <div>
                <span
                  className={
                    styles.modalEyebrow
                  }
                >
                  Nuevo proyecto
                </span>

                <h2
                  id="new-project-title"
                >
                  Crear proyecto
                </h2>

                <p>
                  Completa la
                  información para
                  registrar un nuevo
                  proyecto.
                </p>
              </div>

              <button
                className={
                  styles.modalCloseButton
                }
                type="button"
                onClick={
                  cerrarFormulario
                }
                aria-label="Cerrar formulario"
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
                styles.modalContent
              }
            >
              <ProjectForm
                onCreado={
                  proyectoCreado
                }
                onCancelar={
                  cerrarFormulario
                }
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}