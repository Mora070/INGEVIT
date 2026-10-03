import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  subirCapaProyecto,
} from '../../api/capas.api';

import type {
  CapaProyecto,
} from '../../types/capa';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './UploadLayerModal.module.css';

interface UploadLayerModalProps {
  idProyecto: string;

  onCerrar: () => void;

  onSubida: (
    capa: CapaProyecto,
  ) => void;
}

function formatearTamano(
  bytes: number,
): string {
  if (
    bytes < 1024
  ) {
    return `${bytes} B`;
  }

  const kb =
    bytes / 1024;

  if (
    kb < 1024
  ) {
    return `${kb.toFixed(
      1,
    )} KB`;
  }

  const mb =
    kb / 1024;

  if (
    mb < 1024
  ) {
    return `${mb.toFixed(
      1,
    )} MB`;
  }

  const gb =
    mb / 1024;

  return `${gb.toFixed(
    2,
  )} GB`;
}

function obtenerTiempoEstimado(
  bytes: number,
): string {
  const mb =
    bytes /
    (1024 * 1024);

  if (
    mb <= 100
  ) {
    return 'aproximadamente 1 a 2 minutos';
  }

  if (
    mb <= 300
  ) {
    return 'aproximadamente 2 a 4 minutos';
  }

  if (
    mb <= 600
  ) {
    return 'aproximadamente 4 a 7 minutos';
  }

  if (
    mb <= 1000
  ) {
    return 'aproximadamente 7 a 12 minutos';
  }

  if (
    mb <= 3000
  ) {
    return 'aproximadamente 12 a 20 minutos';
  }

  return 'más de 20 minutos';
}

function archivoGeoTiffValido(
  archivo: File,
): boolean {
  const nombre =
    archivo.name.toLowerCase();

  return (
    nombre.endsWith(
      '.tif',
    ) ||
    nombre.endsWith(
      '.tiff',
    )
  );
}

export function UploadLayerModal({
  idProyecto,
  onCerrar,
  onSubida,
}: UploadLayerModalProps) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    nombre,
    setNombre,
  ] = useState('');

  const [
    descripcion,
    setDescripcion,
  ] = useState('');

  const [
    archivo,
    setArchivo,
  ] = useState<File | null>(
    null,
  );

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

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape' &&
        !subiendo
      ) {
        onCerrar();
      }
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

  const nombreValido =
    nombre.trim().length >
    0;

  const puedeSubir =
    nombreValido &&
    archivo !==
    null &&
    !subiendo;

  function seleccionarArchivo(
    archivoSeleccionado:
      File | null,
  ) {
    if (
      !archivoSeleccionado
    ) {
      return;
    }

    if (
      !archivoGeoTiffValido(
        archivoSeleccionado,
      )
    ) {
      setArchivo(
        null,
      );

      setError(
        'Selecciona un archivo GeoTIFF con extensión .tif o .tiff.',
      );

      return;
    }

    setArchivo(
      archivoSeleccionado,
    );

    setError(
      null,
    );

    if (
      nombre.trim().length ===
      0
    ) {
      const nombreSinExtension =
        archivoSeleccionado.name.replace(
          /\.tiff?$/i,
          '',
        );

      setNombre(
        nombreSinExtension,
      );
    }
  }

  async function subir() {
    if (
      !puedeSubir ||
      !archivo
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
      const nuevaCapa =
        await subirCapaProyecto(
          idProyecto,
          {
            nombre:
              nombre.trim(),

            descripcion,

            archivo,
          },
        );

      onSubida(
        nuevaCapa,
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
          'No fue posible subir la ortofoto.',
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

  function abrirSelector() {
    if (
      subiendo
    ) {
      return;
    }

    inputRef.current?.click();
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
        aria-labelledby="upload-layer-title"
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
            <h2
              id="upload-layer-title"
            >
              Subir ortofoto
            </h2>

            <p>
              Carga un archivo GeoTIFF georreferenciado.
              El backend procesará la ortofoto y generará
              las teselas para visualizarla en el mapa.
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
              styles.field
            }
          >
            <label
              htmlFor="layer-name"
            >
              Nombre
            </label>

            <input
              id="layer-name"
              type="text"
              value={
                nombre
              }
              onChange={(
                event,
              ) => {
                setNombre(
                  event.target.value,
                );

                setError(
                  null,
                );
              }}
              disabled={
                subiendo
              }
              placeholder="Ej. Ortofoto septiembre 2026"
              autoFocus
            />
          </div>

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="layer-description"
            >
              Descripción
            </label>

            <textarea
              id="layer-description"
              value={
                descripcion
              }
              onChange={(
                event,
              ) => {
                setDescripcion(
                  event.target.value,
                );

                setError(
                  null,
                );
              }}
              disabled={
                subiendo
              }
              rows={
                4
              }
              placeholder="Descripción opcional de la ortofoto."
            />
          </div>

          <div
            className={
              styles.field
            }
          >
            <label>
              Archivo GeoTIFF
            </label>

            <div
              className={`${styles.dropzone} ${subiendo
                ? styles.dropzoneDisabled
                : ''
                }`}
              role="button"
              tabIndex={
                subiendo
                  ? -1
                  : 0
              }
              onClick={
                abrirSelector
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  subiendo
                ) {
                  return;
                }

                if (
                  event.key ===
                  'Enter' ||
                  event.key ===
                  ' '
                ) {
                  event.preventDefault();

                  abrirSelector();
                }
              }}
            >
              <input
                ref={
                  inputRef
                }
                className={
                  styles.fileInput
                }
                type="file"
                accept=".tif,.tiff,image/tiff"
                disabled={
                  subiendo
                }
                onChange={(
                  event,
                ) => {
                  seleccionarArchivo(
                    event.target.files?.[
                    0
                    ] ?? null,
                  );

                  event.target.value =
                    '';
                }}
              />

              <span
                className={
                  styles.fileIcon
                }
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                >
                  <path d="M4 5a2 2 0 0 1 2-2h7l7 7v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" />

                  <path d="M13 3v7h7" />

                  <path d="M8 16h8" />

                  <path d="M12 12v8" />
                </svg>
              </span>

              <div
                className={
                  styles.fileInfo
                }
              >
                {archivo ? (
                  <>
                    <strong
                      title={
                        archivo.name
                      }
                    >
                      {archivo.name}
                    </strong>

                    <span>
                      {formatearTamano(
                        archivo.size,
                      )}
                      {' · '}
                      Haz clic para cambiar el archivo
                    </span>
                  </>
                ) : (
                  <>
                    <strong>
                      Selecciona una ortofoto
                    </strong>

                    <span>
                      Archivo GeoTIFF .tif o .tiff
                    </span>
                  </>
                )}
              </div>
            </div>

            <p
              className={
                styles.helper
              }
            >
              La georreferenciación, el CRS y la extensión
              espacial se obtendrán automáticamente del archivo.
            </p>
            {archivo && (
              <div
                className={
                  styles.estimatedTime
                }
              >
                <strong>
                  Tiempo estimado de carga inicial:
                </strong>{' '}
                {obtenerTiempoEstimado(
                  archivo.size,
                )}.
                {' '}
                Este tiempo puede variar según la velocidad
                de conexión y el tamaño de la ortofoto.
                El procesamiento continuará después de la carga.
              </div>
            )}
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
              styles.uploadButton
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
              : 'Subir ortofoto'}
          </button>
        </footer>
      </section>
    </div>
  );
}