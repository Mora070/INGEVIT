import {
  useEffect,
  useState,
} from 'react';

import {
  obtenerProyecto,
} from '../../api/proyectos.api';

import type {
  Proyecto,
} from '../../types/proyecto';

import { ApiError } from '../../../../shared/api/http';

import styles from './ProjectDetailPage.module.css';

interface ProjectDetailPageProps {
  idProyecto: string;
  onVolver: () => void;
}

function formatearEstado(
  estado: Proyecto['estado_proyecto'],
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

export function ProjectDetailPage({
  idProyecto,
  onVolver,
}: ProjectDetailPageProps) {
  const [
    proyecto,
    setProyecto,
  ] = useState<Proyecto | null>(
    null,
  );

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let activa = true;

    async function cargarProyecto() {
      setCargando(true);
      setError(null);

      try {
        const respuesta =
          await obtenerProyecto(
            idProyecto,
          );

        if (!activa) {
          return;
        }

        setProyecto(
          respuesta,
        );
      } catch (errorObtenido) {
        if (!activa) {
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
            'No fue posible cargar el proyecto.',
          );
        }

        setProyecto(null);
      } finally {
        if (activa) {
          setCargando(false);
        }
      }
    }

    void cargarProyecto();

    return () => {
      activa = false;
    };
  }, [
    idProyecto,
  ]);

  if (cargando) {
    return (
      <section
        className={
          styles.page
        }
      >
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

          <h2>
            Cargando proyecto
          </h2>

          <p>
            Estamos consultando la
            información del proyecto.
          </p>
        </div>
      </section>
    );
  }

  if (
    error ||
    !proyecto
  ) {
    return (
      <section
        className={
          styles.page
        }
      >
        <button
          className={
            styles.backButton
          }
          type="button"
          onClick={
            onVolver
          }
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>

          Volver a proyectos
        </button>

        <div
          className={
            styles.state
          }
        >
          <div
            className={
              styles.errorIcon
            }
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />

              <path d="M12 7v6" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <h2>
            No pudimos cargar el
            proyecto
          </h2>

          <p>
            {error}
          </p>
        </div>
      </section>
    );
  }

  const tieneUbicacion =
    proyecto.latitud !== null &&
    proyecto.longitud !== null;

  return (
    <section
      className={
        styles.page
      }
    >
      <button
        className={
          styles.backButton
        }
        type="button"
        onClick={
          onVolver
        }
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>

        Volver a proyectos
      </button>

      <header
        className={
          styles.pageHeader
        }
      >
        <div
          className={
            styles.heading
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            Proyecto
          </span>

          <h1>
            {proyecto.nombre}
          </h1>

          <p>
            {proyecto.descripcion}
          </p>
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
          styles.contentGrid
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
                styles.panelIcon
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 7.5h6l2-2h10v14H3z" />
                <path d="M3 10h18" />
              </svg>
            </div>

            <div>
              <h2>
                Información general
              </h2>

              <p>
                Datos principales del
                proyecto.
              </p>
            </div>
          </header>

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
                Fecha de inicio
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

            <div>
              <dt>
                Ubicación
              </dt>

              <dd>
                {tieneUbicacion
                  ? 'Configurada'
                  : 'Sin coordenadas'}
              </dd>
            </div>
          </dl>
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
                styles.panelIcon
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  cx="9"
                  cy="8"
                  r="3"
                />

                <circle
                  cx="17"
                  cy="10"
                  r="2.5"
                />

                <path d="M3 20a6 6 0 0 1 12 0" />

                <path d="M14 16a5 5 0 0 1 7 4" />
              </svg>
            </div>

            <div>
              <h2>
                Equipo
              </h2>

              <p>
                Propietario y
                colaboradores.
              </p>
            </div>
          </header>

          <div
            className={
              styles.comingSoon
            }
          >
            <strong>
              Gestión de colaboradores
            </strong>

            <span>
              Aquí agregaremos los
              miembros que participan
              en este proyecto.
            </span>
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
                styles.panelIcon
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="m8 15 3-4 3 2 4-6" />
              </svg>
            </div>

            <div>
              <h2>
                Actividad
              </h2>

              <p>
                Historial reciente del
                proyecto.
              </p>
            </div>
          </header>

          <div
            className={
              styles.comingSoon
            }
          >
            <strong>
              Actividades del proyecto
            </strong>

            <span>
              Aquí conectaremos el
              historial de acciones y
              actualizaciones.
            </span>
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
                styles.panelIcon
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                />

                <circle
                  cx="9"
                  cy="10"
                  r="2"
                />

                <path d="m21 15-5-4-7 7" />
              </svg>
            </div>

            <div>
              <h2>
                Fotografías
              </h2>

              <p>
                Evidencia visual del
                proyecto.
              </p>
            </div>
          </header>

          <div
            className={
              styles.comingSoon
            }
          >
            <strong>
              Galería del proyecto
            </strong>

            <span>
              Las fotografías se
              administrarán desde esta
              sección.
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}