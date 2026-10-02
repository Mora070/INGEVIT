import {
  useEffect,
  useState,
} from 'react';

import type {
  MouseEvent,
} from 'react';

import {
  subirFotografiaProyecto,
} from '../../api/fotografias.api';

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

  latitudProyecto?:
    number | null;

  longitudProyecto?:
    number | null;

  onCerrar: () => void;

  onSubidaCompleta: (
    fotografia:
      FotografiaProyecto,
  ) => void;
}

interface ValidacionFotografia {
  valida: boolean;

  esPanoramica360:
    boolean;

  ancho:
    number | null;

  alto:
    number | null;

  mensaje:
    string | null;
}

const ANCHO_MINIMO_PANORAMICA =
  2048;

const ALTO_MINIMO_PANORAMICA =
  1024;

const PROPORCION_MINIMA_PANORAMICA =
  1.98;

const PROPORCION_MAXIMA_PANORAMICA =
  2.02;

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
    bytes /
    1024;

  if (
    kilobytes <
    1024
  ) {
    return `${kilobytes.toFixed(
      1,
    )} KB`;
  }

  const megabytes =
    kilobytes /
    1024;

  return `${megabytes.toFixed(
    1,
  )} MB`;
}

async function validarFotografia(
  archivo: File,
): Promise<ValidacionFotografia> {
  const urlTemporal =
    URL.createObjectURL(
      archivo,
    );

  try {
    const dimensiones =
      await new Promise<{
        ancho: number;
        alto: number;
      }>(
        (
          resolve,
          reject,
        ) => {
          const imagen =
            new Image();

          imagen.onload =
            () => {
              resolve({
                ancho:
                  imagen.naturalWidth,

                alto:
                  imagen.naturalHeight,
              });
            };

          imagen.onerror =
            () => {
              reject(
                new Error(
                  'No se pudo interpretar la imagen.',
                ),
              );
            };

          imagen.src =
            urlTemporal;
        },
      );

    const {
      ancho,
      alto,
    } =
      dimensiones;

    if (
      !Number.isFinite(
        ancho,
      ) ||
      !Number.isFinite(
        alto,
      ) ||
      ancho <
        1 ||
      alto <
        1
    ) {
      return {
        valida:
          false,

        esPanoramica360:
          false,

        ancho,

        alto,

        mensaje:
          'La imagen seleccionada no contiene dimensiones válidas.',
      };
    }

    const proporcion =
      ancho /
      alto;

    const cumpleTamano360 =
      ancho >=
        ANCHO_MINIMO_PANORAMICA &&
      alto >=
        ALTO_MINIMO_PANORAMICA;

    const cumpleProporcion360 =
      proporcion >=
        PROPORCION_MINIMA_PANORAMICA &&
      proporcion <=
        PROPORCION_MAXIMA_PANORAMICA;

    const esPanoramica360 =
      cumpleTamano360 &&
      cumpleProporcion360;

    if (
      esPanoramica360
    ) {
      return {
        valida:
          false,

        esPanoramica360:
          true,

        ancho,

        alto,

        mensaje:
          'Esta imagen corresponde a una panorámica 360°. Debes cargarla desde la sección 360°.',
      };
    }

    return {
      valida:
        true,

      esPanoramica360:
        false,

      ancho,

      alto,

      mensaje:
        null,
    };
  } catch {
    return {
      valida:
        false,

      esPanoramica360:
        false,

      ancho:
        null,

      alto:
        null,

      mensaje:
        'No se pudo interpretar la imagen seleccionada.',
    };
  } finally {
    URL.revokeObjectURL(
      urlTemporal,
    );
  }
}

export function UploadPhotoModal({
  idProyecto,
  archivo,
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
    subiendo,
    setSubiendo,
  ] = useState(
    false,
  );

  const [
    validando,
    setValidando,
  ] = useState(
    true,
  );

  const [
    validacion,
    setValidacion,
  ] =
    useState<ValidacionFotografia>({
      valida:
        false,

      esPanoramica360:
        false,

      ancho:
        null,

      alto:
        null,

      mensaje:
        null,
    });

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    urlPrevisualizacion,
    setUrlPrevisualizacion,
  ] = useState<
    string | null
  >(
    null,
  );

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
    let activo =
      true;

    async function comprobarArchivo() {
      setValidando(
        true,
      );

      setError(
        null,
      );

      const resultado =
        await validarFotografia(
          archivo,
        );

      if (
        !activo
      ) {
        return;
      }

      setValidacion(
        resultado,
      );

      setValidando(
        false,
      );
    }

    void comprobarArchivo();

    return () => {
      activo =
        false;
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

  const tituloValido =
    titulo.trim().length >
    0;

  const puedeSubir =
    tituloValido &&
    validacion.valida &&
    !validando &&
    !subiendo;

  async function subir() {
    if (
      !puedeSubir
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
      MouseEvent<
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
              Agrega una fotografía a la galería del proyecto.
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
                  Título de la fotografía
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
                      event.target.value,
                    );

                    setError(
                      null,
                    );
                  }}
                  disabled={
                    subiendo ||
                    validando ||
                    validacion.esPanoramica360
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

                  {validacion.ancho !==
                    null &&
                    validacion.alto !==
                      null &&
                    ` · ${validacion.ancho} × ${validacion.alto}px`}
                </small>
              </div>
            </div>
          </div>

          {validando && (
            <p>
              Verificando imagen...
            </p>
          )}

          {!validando &&
            !validacion.valida &&
            validacion.mensaje && (
              <p
                className={
                  styles.error
                }
                role="alert"
              >
                {
                  validacion.mensaje
                }
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
            {validando
              ? 'Validando...'
              : subiendo
                ? 'Subiendo...'
                : validacion.esPanoramica360
                  ? 'Usar sección 360°'
                  : 'Subir fotografía'}
          </button>
        </footer>
      </section>
    </div>
  );
}