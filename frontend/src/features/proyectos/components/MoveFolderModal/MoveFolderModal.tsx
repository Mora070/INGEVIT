import {
  useEffect,
  useState,
} from 'react';

import {
  listarCarpetasProyecto,
  moverCarpetaProyecto,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
} from '../../types/carpeta';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './MoveFolderModal.module.css';

interface MoveFolderModalProps {
  idProyecto: string;

  carpeta: CarpetaProyecto;

  onCerrar: () => void;

  onMovida: (
    carpeta: CarpetaProyecto,
  ) => void;
}

export function MoveFolderModal({
  idProyecto,
  carpeta,
  onCerrar,
  onMovida,
}: MoveFolderModalProps) {
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
    moviendo,
    setMoviendo,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const carpetaDestino =
    ruta.length > 0
      ? ruta[
          ruta.length - 1
        ]
      : null;

  const idDestino =
    carpetaDestino
      ?.id_carpeta ??
    null;

  const mismoDestino =
    carpeta.id_carpeta_padre ===
    idDestino;

  useEffect(() => {
    let activo =
      true;

    async function cargarRaiz() {
      setCargando(
        true,
      );

      setError(
        null,
      );

      try {
        const respuesta =
          await listarCarpetasProyecto(
            idProyecto,
          );

        if (
          !activo
        ) {
          return;
        }

        setCarpetas(
          respuesta.filter(
            (
              elemento,
            ) =>
              elemento.id_carpeta !==
              carpeta.id_carpeta,
          ),
        );

        setRuta(
          [],
        );
      } catch (
        errorObtenido
      ) {
        if (
          !activo
        ) {
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
            'No fue posible cargar las carpetas del proyecto.',
          );
        }
      } finally {
        if (
          activo
        ) {
          setCargando(
            false,
          );
        }
      }
    }

    void cargarRaiz();

    return () => {
      activo =
        false;
    };
  }, [
    idProyecto,
    carpeta.id_carpeta,
  ]);

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        !moviendo
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
    moviendo,
    onCerrar,
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

  async function cargarUbicacion(
    idCarpetaPadre:
      string | null,
    nuevaRuta:
      CarpetaProyecto[],
  ) {
    if (
      cargando ||
      moviendo
    ) {
      return;
    }

    setCargando(
      true,
    );

    setError(
      null,
    );

    try {
      const respuesta =
        await listarCarpetasProyecto(
          idProyecto,
          idCarpetaPadre,
        );

      setCarpetas(
        respuesta.filter(
          (
            elemento,
          ) =>
            elemento.id_carpeta !==
            carpeta.id_carpeta,
        ),
      );

      setRuta(
        nuevaRuta,
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
          'No fue posible abrir esta ubicación.',
        );
      }
    } finally {
      setCargando(
        false,
      );
    }
  }

  function abrirCarpeta(
    destino: CarpetaProyecto,
  ) {
    void cargarUbicacion(
      destino.id_carpeta,
      [
        ...ruta,
        destino,
      ],
    );
  }

  function volverInicio() {
    void cargarUbicacion(
      null,
      [],
    );
  }

  function navegarBreadcrumb(
    destino: CarpetaProyecto,
    indice: number,
  ) {
    void cargarUbicacion(
      destino.id_carpeta,
      ruta.slice(
        0,
        indice + 1,
      ),
    );
  }

  async function mover() {
    if (
      moviendo ||
      cargando ||
      mismoDestino
    ) {
      return;
    }

    setMoviendo(
      true,
    );

    setError(
      null,
    );

    try {
      const carpetaMovida =
        await moverCarpetaProyecto(
          idProyecto,
          carpeta.id_carpeta,
          {
            id_carpeta_padre:
              idDestino,
          },
        );

      onMovida(
        carpetaMovida,
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
          'No fue posible mover la carpeta.',
        );
      }
    } finally {
      setMoviendo(
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
      !moviendo
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
        aria-labelledby="move-folder-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.headerIcon
            }
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
            >
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" />

              <path d="m10 11 2 2 2-2" />

              <path d="M12 9v6" />
            </svg>
          </div>

          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="move-folder-title"
            >
              Mover carpeta
            </h2>

            <p>
              Selecciona la nueva ubicación para{' '}
              <strong>
                {carpeta.nombre}
              </strong>
              .
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
              moviendo
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
              styles.locationLabel
            }
          >
            <span>
              Ubicación de destino
            </span>

            <strong>
              {carpetaDestino
                ? carpetaDestino.nombre
                : 'Inicio'}
            </strong>
          </div>

          <nav
            className={
              styles.breadcrumb
            }
            aria-label="Ubicación de destino"
          >
            <button
              type="button"
              className={
                styles.breadcrumbButton
              }
              disabled={
                ruta.length ===
                0
              }
              onClick={
                volverInicio
              }
            >
              Inicio
            </button>

            {ruta.map(
              (
                elemento,
                indice,
              ) => {
                const esActual =
                  indice ===
                  ruta.length -
                    1;

                return (
                  <div
                    key={
                      elemento.id_carpeta
                    }
                    className={
                      styles.breadcrumbItem
                    }
                  >
                    <span
                      className={
                        styles.breadcrumbSeparator
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
                      disabled={
                        esActual
                      }
                      onClick={() => {
                        navegarBreadcrumb(
                          elemento,
                          indice,
                        );
                      }}
                      title={
                        elemento.nombre
                      }
                    >
                      {
                        elemento.nombre
                      }
                    </button>
                  </div>
                );
              },
            )}
          </nav>

          <div
            className={
              styles.explorer
            }
          >
            {cargando ? (
              <div
                className={
                  styles.state
                }
              >
                <span
                  className={
                    styles.loader
                  }
                  aria-hidden="true"
                />

                <strong>
                  Cargando carpetas...
                </strong>
              </div>
            ) : carpetas.length ===
              0 ? (
              <div
                className={
                  styles.state
                }
              >
                <div
                  className={
                    styles.emptyIcon
                  }
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" />
                  </svg>
                </div>

                <strong>
                  No hay subcarpetas
                </strong>

                <p>
                  Puedes mover la carpeta directamente a esta ubicación.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.folderList
                }
              >
                {carpetas.map(
                  (
                    destino,
                  ) => (
                    <button
                      key={
                        destino.id_carpeta
                      }
                      className={
                        styles.folder
                      }
                      type="button"
                      onClick={() => {
                        abrirCarpeta(
                          destino,
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
                          <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z" />
                        </svg>
                      </span>

                      <span
                        className={
                          styles.folderName
                        }
                      >
                        {
                          destino.nombre
                        }
                      </span>

                      <span
                        className={
                          styles.arrow
                        }
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {mismoDestino && (
            <p
              className={
                styles.currentNotice
              }
            >
              La carpeta ya se encuentra en esta ubicación.
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
              moviendo
            }
          >
            Cancelar
          </button>

          <button
            className={
              styles.moveButton
            }
            type="button"
            onClick={() => {
              void mover();
            }}
            disabled={
              cargando ||
              moviendo ||
              mismoDestino
            }
          >
            {moviendo
              ? 'Moviendo...'
              : 'Mover aquí'}
          </button>
        </footer>
      </section>
    </div>
  );
}