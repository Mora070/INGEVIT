import {
  useEffect,
} from 'react';

import type {
  MouseEvent,
} from 'react';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import styles from './PhotoViewer.module.css';

interface PhotoViewerProps {
  fotografia:
    FotografiaProyecto;

  onCerrar:
    () => void;
}

export function PhotoViewer({
  fotografia,
  onCerrar,
}: PhotoViewerProps) {
  useEffect(() => {
    function manejarTeclado(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        onCerrar();
      }
    }

    window.addEventListener(
      'keydown',
      manejarTeclado,
    );

    const overflowAnterior =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      window.removeEventListener(
        'keydown',
        manejarTeclado,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    onCerrar,
  ]);

  function cerrarDesdeFondo(
    event:
      MouseEvent<HTMLDivElement>,
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      onCerrar();
    }
  }

  return (
    <div
      className={
        styles.overlay
      }
      role="presentation"
      onMouseDown={
        cerrarDesdeFondo
      }
    >
      <section
        className={
          styles.viewer
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-viewer-title"
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
            <span>
              Fotografía
            </span>

            <h2
              id="photo-viewer-title"
            >
              {
                fotografia.titulo
              }
            </h2>
          </div>

          <button
            className={
              styles.closeButton
            }
            type="button"
            onClick={
              onCerrar
            }
            aria-label="Cerrar fotografía"
            title="Cerrar"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12"
              />

              <path
                d="M18 6 6 18"
              />
            </svg>
          </button>
        </header>

        <div
          className={
            styles.imageArea
          }
        >
          <img
            className={
              styles.image
            }
            src={
              fotografia.url
            }
            alt={
              fotografia.titulo
            }
          />
        </div>

        <footer
          className={
            styles.footer
          }
        >
          <div>
            <strong>
              {
                fotografia.titulo
              }
            </strong>

            <span>
              {new Intl.DateTimeFormat(
                'es-CO',
                {
                  day:
                    'numeric',

                  month:
                    'long',

                  year:
                    'numeric',
                },
              ).format(
                new Date(
                  fotografia.fecha_subida,
                ),
              )}
            </span>
          </div>

          {fotografia.es_portada && (
            <span
              className={
                styles.coverBadge
              }
            >
              Portada del proyecto
            </span>
          )}
        </footer>
      </section>
    </div>
  );
}