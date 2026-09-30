import {
  useEffect,
  useState,
} from 'react';

import {
  subirPanoramicaProyecto,
} from '../../api/panoramicas.api';

import type {
  PanoramicaProyecto,
} from '../../types/panoramica';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './UploadPanoramaModal.module.css';

interface UploadPanoramaModalProps {
  idProyecto: string;

  archivo: File;

  /*
   * Se conservan temporalmente para no romper
   * los componentes que todavía las envíen.
   *
   * Ya no intervienen en la subida.
   */
  latitudProyecto?:
    number | null;

  longitudProyecto?:
    number | null;

  onCerrar: () => void;

  onSubidaCompleta: (
    panoramica:
      PanoramicaProyecto,
  ) => void;
}

interface ValidacionImagen {
  valida: boolean;

  ancho:
    number | null;

  alto:
    number | null;

  mensaje:
    string | null;
}

const ANCHO_MINIMO =
  2048;

const ALTO_MINIMO =
  1024;

const PROPORCION_MINIMA =
  1.98;

const PROPORCION_MAXIMA =
  2.02;

const TIPOS_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_BYTES =
  50 *
  1024 *
  1024;

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
    'Panorámica 360°'
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

function validarTipoArchivo(
  archivo: File,
): string | null {
  if (
    !TIPOS_PERMITIDOS.includes(
      archivo.type,
    )
  ) {
    return 'Solo se permiten panorámicas JPG, JPEG, PNG y WebP.';
  }

  if (
    archivo.size ===
    0
  ) {
    return 'El archivo seleccionado está vacío.';
  }

  if (
    archivo.size >
    MAX_BYTES
  ) {
    return 'La panorámica no puede superar 50 MB.';
  }

  return null;
}

async function validarDimensionesImagen(
  archivo: File,
): Promise<ValidacionImagen> {
  const errorTipo =
    validarTipoArchivo(
      archivo,
    );

  if (
    errorTipo
  ) {
    return {
      valida:
        false,

      ancho:
        null,

      alto:
        null,

      mensaje:
        errorTipo,
    };
  }

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

        ancho,

        alto,

        mensaje:
          'La imagen no contiene dimensiones válidas.',
      };
    }

    if (
      ancho <
        ANCHO_MINIMO ||
      alto <
        ALTO_MINIMO
    ) {
      return {
        valida:
          false,

        ancho,

        alto,

        mensaje:
          `La panorámica debe tener al menos ${ANCHO_MINIMO} × ${ALTO_MINIMO} píxeles.`,
      };
    }

    const proporcion =
      ancho /
      alto;

    const esDosAUno =
      proporcion >=
        PROPORCION_MINIMA &&
      proporcion <=
        PROPORCION_MAXIMA;

    if (
      !esDosAUno
    ) {
      return {
        valida:
          false,

        ancho,

        alto,

        mensaje:
          'La imagen no es compatible con el visor 360°. Debe ser una panorámica equirectangular con proporción aproximada 2:1.',
      };
    }

    return {
      valida:
        true,

      ancho,

      alto,

      mensaje:
        null,
    };
  } catch {
    return {
      valida:
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

export function UploadPanoramaModal({
  idProyecto,
  archivo,
  onCerrar,
  onSubidaCompleta,
}: UploadPanoramaModalProps) {
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
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    validacion,
    setValidacion,
  ] = useState<ValidacionImagen>({
    valida:
      false,

    ancho:
      null,

    alto:
      null,

    mensaje:
      null,
  });

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

    async function validarArchivo() {
      setValidando(
        true,
      );

      setError(
        null,
      );

      const resultado =
        await validarDimensionesImagen(
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

    void validarArchivo();

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
      const panoramica =
        await subirPanoramicaProyecto(
          idProyecto,
          {
            titulo:
              titulo.trim(),

            archivo,
          },
        );

      onSubidaCompleta(
        panoramica,
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
          'No fue posible subir la panorámica 360°.',
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
        aria-labelledby="upload-panorama-title"
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
              id="upload-panorama-title"
            >
              Subir panorámica 360°
            </h2>

            <p>
              Agrega una panorámica 360° a la galería del proyecto.
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
              styles.previewSection
            }
          >
            <div
              className={
                styles.preview
              }
            >
              {urlPrevisualizacion ? (
                <>
                  <img
                    src={
                      urlPrevisualizacion
                    }
                    alt="Vista previa de la panorámica seleccionada"
                  />

                  <span
                    className={
                      styles.previewBadge
                    }
                  >
                    360°
                  </span>
                </>
              ) : (
                <div
                  className={
                    styles.previewPlaceholder
                  }
                >
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
                  htmlFor="titulo-panoramica"
                >
                  Título de la panorámica
                </label>

                <input
                  id="titulo-panoramica"
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

                  {validacion.ancho !==
                    null &&
                    validacion.alto !==
                      null &&
                    ` · ${validacion.ancho} × ${validacion.alto}px`}
                </small>
              </div>

              {validando && (
                <p
                  className={
                    styles.notice
                  }
                >
                  Verificando que la imagen sea compatible con el visor 360°...
                </p>
              )}

              {!validando &&
                validacion.valida && (
                  <p
                    className={
                      styles.notice
                    }
                  >
                    La imagen cumple la resolución y proporción necesarias para el visor 360°.
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
            </div>
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
            {validando
              ? 'Validando...'
              : subiendo
                ? 'Subiendo...'
                : 'Subir panorámica 360°'}
          </button>
        </footer>
      </section>
    </div>
  );
}