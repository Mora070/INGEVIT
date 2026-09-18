import {
  useMemo,
  useState,
} from 'react';

import { useProyectos } from '../../../proyectos/hooks/useProyectos';
import { ProjectsMap } from '../../../proyectos/components/ProjectsMap/ProjectsMap';

import styles from './HomePage.module.css';

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

function formatearFecha(
  fecha: string | null,
): string {
  if (!fecha) {
    return 'Sin fecha';
  }

  const [anio, mes, dia] =
    fecha.split('-');

  if (!anio || !mes || !dia) {
    return fecha;
  }

  return `${dia}/${mes}/${anio}`;
}

export function HomePage() {
  const [busqueda, setBusqueda] =
    useState('');

  const {
    cargando,
    proyectos,
    total,
    error,
    recargar,
  } = useProyectos(1, 20);

  const proyectosFiltrados =
    useMemo(() => {
      const termino =
        busqueda
          .trim()
          .toLowerCase();

      if (!termino) {
        return proyectos;
      }

      return proyectos.filter(
        (proyecto) => {
          const texto = [
            proyecto.nombre,
            proyecto.direccion,
            proyecto.contratante,
            proyecto.descripcion,
          ]
            .join(' ')
            .toLowerCase();

          return texto.includes(
            termino,
          );
        },
      );
    }, [busqueda, proyectos]);

  const proyectosConUbicacion =
    useMemo(
      () =>
        proyectosFiltrados.filter(
          (proyecto) =>
            proyecto.latitud !== null &&
            proyecto.longitud !== null,
        ),
      [proyectosFiltrados],
    );

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>
            Inicio
          </h1>

          <p className={styles.subtitle}>
            Resumen general de tus proyectos.
          </p>
        </div>

        <div className={styles.actions}>
          <label className={styles.searchBox}>
            <span className={styles.srOnly}>
              Buscar proyecto
            </span>

            <input
              type="search"
              placeholder="Buscar proyecto..."
              className={styles.searchInput}
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value,
                )
              }
            />

            <svg
              className={styles.searchIcon}
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
            className={styles.filterButton}
            type="button"
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
          </button>
        </div>
      </header>

      <div className={styles.dashboardGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
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
              className={styles.iconButton}
              type="button"
              aria-label="Ampliar mapa"
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

          <div className={styles.mapContainer}>
            <ProjectsMap
              proyectos={proyectosConUbicacion}
            />
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
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

            <div className={styles.viewButtons}>
              <button
                className={styles.iconButton}
                type="button"
                aria-label="Vista de tarjetas"
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
                className={`${styles.iconButton} ${styles.iconButtonActive}`}
                type="button"
                aria-label="Vista de lista"
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
            <div className={styles.tableHeader}>
              <span>Proyecto</span>
              <span>Ubicación</span>
              <span>Estado</span>
              <span>Inicio</span>
            </div>

            {cargando && (
              <div
                className={styles.emptyState}
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
                  Estamos consultando la
                  información del servidor.
                </p>
              </div>
            )}

            {!cargando && error && (
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
                  No pudimos cargar los
                  proyectos
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
                    {busqueda.trim()
                      ? 'No encontramos proyectos'
                      : 'Aún no tienes proyectos'}
                  </h3>

                  <p>
                    {busqueda.trim()
                      ? 'Prueba con otro nombre, dirección o contratante.'
                      : 'Cuando tengas proyectos disponibles aparecerán en esta lista.'}
                  </p>
                </div>
              )}

            {!cargando &&
              !error &&
              proyectosFiltrados.length >
              0 && (
                <div
                  className={
                    styles.projectRows
                  }
                >
                  {proyectosFiltrados.map(
                    (proyecto) => (
                      <button
                        key={
                          proyecto.id_proyecto
                        }
                        className={
                          styles.projectRow
                        }
                        type="button"
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
                            className={`${styles.statusBadge} ${proyecto.estado_proyecto ===
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

                        <span
                          className={
                            styles.projectDate
                          }
                        >
                          {formatearFecha(
                            proyecto.fecha_inicio,
                          )}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
          </div>
        </article>
      </div>
    </section>
  );
}