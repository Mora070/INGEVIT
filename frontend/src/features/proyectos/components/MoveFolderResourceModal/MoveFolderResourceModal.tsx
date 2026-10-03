import {
  useEffect,
  useState,
} from 'react';

import {
  listarCarpetasProyecto,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
} from '../../types/carpeta';

import styles from './MoveFolderResourceModal.module.css';

interface MoveFolderResourceModalProps {
  idProyecto: string;
  idCarpetaActual: string;
  nombreRecurso: string;
  moviendo: boolean;
  error: string | null;
  onCerrar: () => void;
  onMover: (
    carpetaDestino: CarpetaProyecto,
  ) => void;
}

export function MoveFolderResourceModal({
  idProyecto,
  idCarpetaActual,
  nombreRecurso,
  moviendo,
  error,
  onCerrar,
  onMover,
}: MoveFolderResourceModalProps) {
  const [
    carpetas,
    setCarpetas,
  ] = useState<CarpetaProyecto[]>(
    [],
  );

  const [
    ruta,
    setRuta,
  ] = useState<CarpetaProyecto[]>(
    [],
  );

  const [
    cargando,
    setCargando,
  ] = useState(
    true,
  );

  const [
    errorCarga,
    setErrorCarga,
  ] = useState<string | null>(
    null,
  );

  async function cargarCarpetas(
    idPadre: string | null,
  ) {
    setCargando(
      true,
    );

    setErrorCarga(
      null,
    );

    try {
      const resultado =
        await listarCarpetasProyecto(
          idProyecto,
          idPadre,
        );

      setCarpetas(
        resultado,
      );
    } catch {
      setErrorCarga(
        'No fue posible cargar las carpetas.',
      );

      setCarpetas(
        [],
      );
    } finally {
      setCargando(
        false,
      );
    }
  }

  useEffect(() => {
    void cargarCarpetas(
      null,
    );
  }, [
    idProyecto,
  ]);

  useEffect(() => {
    function manejarTeclado(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape' &&
        !moviendo
      ) {
        onCerrar();
      }
    }

    window.addEventListener(
      'keydown',
      manejarTeclado,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        manejarTeclado,
      );
    };
  }, [
    moviendo,
    onCerrar,
  ]);

  async function abrirCarpeta(
    carpeta: CarpetaProyecto,
  ) {
    setRuta((
      actual,
    ) => [
      ...actual,
      carpeta,
    ]);

    await cargarCarpetas(
      carpeta.id_carpeta,
    );
  }

  async function volverRaiz() {
    setRuta(
      [],
    );

    await cargarCarpetas(
      null,
    );
  }

  async function navegarRuta(
    indice: number,
  ) {
    const carpeta =
      ruta[indice];

    if (
      !carpeta
    ) {
      return;
    }

    setRuta(
      ruta.slice(
        0,
        indice + 1,
      ),
    );

    await cargarCarpetas(
      carpeta.id_carpeta,
    );
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !moviendo
        ) {
          onCerrar();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-resource-title"
      >
        <header
          className={styles.header}
        >
          <div>
            <h2
              id="move-resource-title"
              className={styles.title}
            >
              Mover a...
            </h2>

            <p
              className={
                styles.subtitle
              }
            >
              Selecciona una carpeta
              para mover{' '}
              <strong>
                {nombreRecurso}
              </strong>
              .
            </p>
          </div>

          <button
            type="button"
            className={
              styles.closeButton
            }
            onClick={onCerrar}
            disabled={moviendo}
            aria-label="Cerrar"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>

        <nav
          className={
            styles.breadcrumb
          }
          aria-label="Ruta de carpetas"
        >
          <button
            type="button"
            className={
              styles.breadcrumbButton
            }
            onClick={() => {
              void volverRaiz();
            }}
            disabled={moviendo}
          >
            Carpetas
          </button>

          {ruta.map((
            carpeta,
            indice,
          ) => (
            <div
              key={
                carpeta.id_carpeta
              }
              className={
                styles.breadcrumbItem
              }
            >
              <span
                className={
                  styles.separator
                }
                aria-hidden="true"
              >
                /
              </span>

              <button
                type="button"
                className={
                  styles.breadcrumbButton
                }
                onClick={() => {
                  void navegarRuta(
                    indice,
                  );
                }}
                disabled={moviendo}
              >
                {carpeta.nombre}
              </button>
            </div>
          ))}
        </nav>

        <div
          className={
            styles.folderArea
          }
        >
          {cargando ? (
            <div
              className={
                styles.status
              }
            >
              Cargando carpetas...
            </div>
          ) : errorCarga ? (
            <div
              className={
                styles.statusError
              }
            >
              {errorCarga}
            </div>
          ) : carpetas.length ===
            0 ? (
            <div
              className={
                styles.empty
              }
            >
              Esta ubicación no tiene
              subcarpetas.
            </div>
          ) : (
            <div
              className={
                styles.folderList
              }
            >
              {carpetas.map((
                carpeta,
              ) => {
                const esActual =
                  carpeta.id_carpeta ===
                  idCarpetaActual;

                return (
                  <div
                    key={
                      carpeta.id_carpeta
                    }
                    className={
                      styles.folderRow
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.folderOpen
                      }
                      onClick={() => {
                        void abrirCarpeta(
                          carpeta,
                        );
                      }}
                      disabled={
                        moviendo
                      }
                    >
                      <span
                        className={
                          styles.folderIcon
                        }
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                        >
                          <path d="M3.5 7.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19V7.5Z" />
                          <path d="M3.5 7.5V6A1.5 1.5 0 0 1 5 4.5h4l2 2h8A1.5 1.5 0 0 1 20.5 8v1.5" />
                        </svg>
                      </span>

                      <span
                        className={
                          styles.folderName
                        }
                      >
                        {carpeta.nombre}
                      </span>

                      {esActual && (
                        <span
                          className={
                            styles.currentBadge
                          }
                        >
                          Actual
                        </span>
                      )}

                      <svg
                        className={
                          styles.chevron
                        }
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className={
                        styles.selectButton
                      }
                      onClick={() => {
                        onMover(
                          carpeta,
                        );
                      }}
                      disabled={
                        moviendo ||
                        esActual
                      }
                    >
                      {esActual
                        ? 'Ubicación actual'
                        : 'Mover aquí'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(error ||
          errorCarga) && (
          <div
            className={
              styles.footerError
            }
            role="alert"
          >
            {error ??
              errorCarga}
          </div>
        )}

        <footer
          className={styles.footer}
        >
          <p
            className={
              styles.footerHint
            }
          >
            El archivo original no se
            duplica. Solo cambiará su
            ubicación dentro de
            Carpetas.
          </p>

          <button
            type="button"
            className={
              styles.cancelButton
            }
            onClick={onCerrar}
            disabled={moviendo}
          >
            Cancelar
          </button>
        </footer>
      </section>
    </div>
  );
}