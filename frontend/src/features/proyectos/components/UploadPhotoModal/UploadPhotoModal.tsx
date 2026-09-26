import {
  useEffect,
  useState,
} from 'react';

import {
  subirFotografiaProyecto,
} from '../../api/fotografias.api';

import {
  PhotoLocationPicker,
} from '../PhotoLocationPicker/PhotoLocationPicker';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './UploadPhotoModal.module.css';

interface UploadPhotoModalProps {
  idProyecto: string;

  archivo: File;

  latitudProyecto:
    number | null;

  longitudProyecto:
    number | null;

  onCerrar: () => void;

  onSubidaCompleta: (
    fotografia:
      FotografiaProyecto,
  ) => void;
}

function obtenerTituloInicial(
  archivo: File,
): string {
  const sinExtension =
    archivo.name.replace(
      /\.[^.]+$/,
      '',
    );

  const limpio =
    sinExtension.trim();

  return (
    limpio ||
    'Fotografía del proyecto'
  );
}

function formatearTamanoArchivo(
  bytes: number,
): string {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  const kilobytes =
    bytes / 1024;

  if (
    kilobytes <
    1024
  ) {
    return `${kilobytes.toFixed(
      1,
    )} KB`;
  }

  const megabytes =
    kilobytes / 1024;

  return `${megabytes.toFixed(
    1,
  )} MB`;
}

export function UploadPhotoModal({
  idProyecto,
  archivo,
  latitudProyecto,
  longitudProyecto,
  onCerrar,
  onSubidaCompleta,
}: UploadPhotoModalProps) {
  const [
    titulo,
    setTitulo,
  ] = useState(
    () =>
      obtenerTituloInicial(
        archivo,
      ),
  );

  const [
    latitud,
    setLatitud,
  ] = useState<
    number | null
  >(null);

  const [
    longitud,
    setLongitud,
  ] = useState<
    number | null
  >(null);

  const [
    subiendo,
    setSubiendo,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    urlPrevisualizacion,
    setUrlPrevisualizacion,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    const nuevaUrl =
      URL.createObjectURL(
        archivo,
      );

    setUrlPrevisualizacion(
      nuevaUrl,
    );

    return () => {
      URL.revokeObjectURL(
        nuevaUrl,
      );
    };
  }, [
    archivo,
  ]);

  useEffect(() => {
    const manejarEscape = (
      event:
        KeyboardEvent,
    ) => {
      if (
        event.key ===
          'Escape' &&
        !subiendo
      ) {
        onCerrar();
      }
    };

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
    onCerrar,
    subiendo,
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

  const tieneUbicacion =
    latitud !== null &&
    longitud !== null;

  const tituloValido =
    titulo.trim().length >
    0;

  const puedeSubir =
    tituloValido &&
    tieneUbicacion &&
    !subiendo;

  async function subir() {
    if (
      !puedeSubir ||
      latitud === null ||
      longitud === null
    ) {
      return;
    }

    setSubiendo(
      true,
    );

    setError(
      null,
    );

    try {
      const fotografia =
        await subirFotografiaProyecto(
          idProyecto,
          {
            titulo:
              titulo.trim(),

            archivo,

            latitud,

            longitud,
          },
        );

      onSubidaCompleta(
        fotografia,
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
          'No fue posible subir la fotografía.',
        );
      }
    } finally {
      setSubiendo(
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
      !subiendo
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
        aria-labelledby="upload-photo-title"
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
              id="upload-photo-title"
            >
              Subir fotografía
            </h2>

            <p>
              Agrega la fotografía
              y selecciona en el
              mapa dónde fue
              tomada.
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
              subiendo
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
              styles.photoSection
            }
          >
            <div
              className={
                styles.preview
              }
            >
              {urlPrevisualizacion ? (
                <img
                  src={
                    urlPrevisualizacion
                  }
                  alt="Vista previa de la fotografía seleccionada"
                />
              ) : (
                <div
                  className={
                    styles.previewPlaceholder
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

                    <path
                      d="m21 15-5-4-7 7"
                    />
                  </svg>

                  <span>
                    Preparando vista previa...
                  </span>
                </div>
              )}
            </div>

            <div
              className={
                styles.fields
              }
            >
              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="titulo-fotografia"
                >
                  Título de la
                  fotografía
                </label>

                <input
                  id="titulo-fotografia"
                  type="text"
                  value={
                    titulo
                  }
                  onChange={(
                    event,
                  ) => {
                    setTitulo(
                      event
                        .target
                        .value,
                    );
                  }}
                  disabled={
                    subiendo
                  }
                  maxLength={
                    200
                  }
                  autoFocus
                />
              </div>

              <div
                className={
                  styles.fileInfo
                }
              >
                <span>
                  {
                    archivo.name
                  }
                </span>

                <small>
                  {formatearTamanoArchivo(
                    archivo.size,
                  )}
                </small>
              </div>
            </div>
          </div>

          <div
            className={
              styles.locationSection
            }
          >
            <PhotoLocationPicker
              latitud={
                latitud
              }
              longitud={
                longitud
              }
              latitudReferencia={
                latitudProyecto
              }
              longitudReferencia={
                longitudProyecto
              }
              disabled={
                subiendo
              }
              onChange={(
                nuevaLatitud,
                nuevaLongitud,
              ) => {
                setLatitud(
                  nuevaLatitud,
                );

                setLongitud(
                  nuevaLongitud,
                );

                setError(
                  null,
                );
              }}
              onLimpiar={() => {
                setLatitud(
                  null,
                );

                setLongitud(
                  null,
                );
              }}
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
              subiendo
            }
          >
            Cancelar
          </button>

          <button
            className={
              styles.submitButton
            }
            type="button"
            onClick={() => {
              void subir();
            }}
            disabled={
              !puedeSubir
            }
          >
            {subiendo
              ? 'Subiendo...'
              : 'Subir fotografía'}
          </button>
        </footer>
      </section>
    </div>
  );
}