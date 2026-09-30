import {
  useEffect,
  useState,
} from 'react';

import {
  subirPlanoProyecto,
} from '../../api/planos.api';

import type {
  PlanoProyecto,
} from '../../types/plano';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './UploadPlanModal.module.css';

interface UploadPlanModalProps {
  idProyecto: string;

  archivo: File;

  onCerrar: () => void;

  onSubidaCompleta: (
    plano: PlanoProyecto,
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
    'Plano del proyecto'
  );
}

function formatearTamanoArchivo(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes =
    bytes / 1024;

  if (kilobytes < 1024) {
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

export function UploadPlanModal({
  idProyecto,
  archivo,
  onCerrar,
  onSubidaCompleta,
}: UploadPlanModalProps) {
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
    descripcion,
    setDescripcion,
  ] = useState('');

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

  const tituloValido =
    titulo.trim().length >
    0;

  const archivoValido =
    archivo.type ===
      'application/pdf' ||
    archivo.name
      .toLowerCase()
      .endsWith(
        '.pdf',
      );

  const puedeSubir =
    tituloValido &&
    archivoValido &&
    !subiendo;

  async function subir() {
    if (!puedeSubir) {
      return;
    }

    setSubiendo(
      true,
    );

    setError(
      null,
    );

    try {
      const plano =
        await subirPlanoProyecto(
          idProyecto,
          {
            titulo:
              titulo.trim(),

            descripcion:
              descripcion.trim(),

            archivo,
          },
        );

      onSubidaCompleta(
        plano,
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
          'No fue posible subir el plano PDF.',
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
        aria-labelledby="upload-plan-title"
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
              id="upload-plan-title"
            >
              Subir plano PDF
            </h2>

            <p>
              Agrega el título y la
              descripción del plano antes
              de subirlo al proyecto.
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
              styles.fileCard
            }
          >
            <div
              className={
                styles.fileIcon
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M6 2h8l4 4v16H6Z"
                />

                <path
                  d="M14 2v5h5"
                />

                <path
                  d="M9 13h6"
                />

                <path
                  d="M9 17h6"
                />
              </svg>
            </div>

            <div
              className={
                styles.fileInfo
              }
            >
              <strong>
                {
                  archivo.name
                }
              </strong>

              <span>
                {formatearTamanoArchivo(
                  archivo.size,
                )}
              </span>
            </div>
          </div>

          {!archivoValido && (
            <p
              className={
                styles.error
              }
              role="alert"
            >
              El archivo seleccionado no
              parece ser un PDF válido.
            </p>
          )}

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
                htmlFor="titulo-plano"
              >
                Título
              </label>

              <input
                id="titulo-plano"
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
                styles.field
              }
            >
              <label
                htmlFor="descripcion-plano"
              >
                Descripción
              </label>

              <textarea
                id="descripcion-plano"
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
                  5
                }
                placeholder="Ej. Plano estructural correspondiente al nivel 1."
              />
            </div>
          </div>

          <p
            className={
              styles.notice
            }
          >
            El sistema validará el contenido
            real del PDF antes de guardarlo.
          </p>

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
              : 'Subir plano'}
          </button>
        </footer>
      </section>
    </div>
  );
}