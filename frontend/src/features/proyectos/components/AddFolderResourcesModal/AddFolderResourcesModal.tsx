import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  listarFotografiasProyecto,
} from '../../api/fotografias.api';

import {
  listarPanoramicasProyecto,
} from '../../api/panoramicas.api';

import {
  listarPlanosProyecto,
} from '../../api/planos.api';

import {
  agregarRecursoCarpeta,
} from '../../api/carpetas.api';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import type {
  PanoramicaProyecto,
} from '../../types/panoramica';

import type {
  PlanoProyecto,
} from '../../types/plano';

import type {
  TipoRecursoCarpeta,
} from '../../types/carpeta';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './AddFolderResourcesModal.module.css';

type TipoPestana =
  | 'FOTOGRAFIA'
  | 'PANORAMICA'
  | 'PLANO';

type RecursoProyecto =
  | FotografiaProyecto
  | PanoramicaProyecto
  | PlanoProyecto;

interface AddFolderResourcesModalProps {
  idProyecto: string;

  idCarpeta: string;

  nombreCarpeta: string;

  onCerrar: () => void;

  onAgregados: () => void;
}

interface RecursoSeleccionado {
  tipo: TipoRecursoCarpeta;

  idRecurso: string;
}

const LIMITE_POR_PAGINA =
  20;

function obtenerIdRecurso(
  tipo: TipoPestana,
  recurso: RecursoProyecto,
): string {
  if (
    tipo === 'FOTOGRAFIA'
  ) {
    return (
      recurso as FotografiaProyecto
    ).id_fotografia;
  }

  if (
    tipo === 'PANORAMICA'
  ) {
    return (
      recurso as PanoramicaProyecto
    ).id_panoramica;
  }

  return (
    recurso as PlanoProyecto
  ).id_plano;
}

export function AddFolderResourcesModal({
  idProyecto,
  idCarpeta,
  nombreCarpeta,
  onCerrar,
  onAgregados,
}: AddFolderResourcesModalProps) {
  const [
    pestana,
    setPestana,
  ] = useState<TipoPestana>(
    'FOTOGRAFIA',
  );

  const [
    fotografias,
    setFotografias,
  ] = useState<FotografiaProyecto[]>(
    [],
  );

  const [
    panoramicas,
    setPanoramicas,
  ] = useState<PanoramicaProyecto[]>(
    [],
  );

  const [
    planos,
    setPlanos,
  ] = useState<PlanoProyecto[]>(
    [],
  );

  const [
    pagina,
    setPagina,
  ] = useState(
    1,
  );

  const [
    totalPaginas,
    setTotalPaginas,
  ] = useState(
    1,
  );

  const [
    cargando,
    setCargando,
  ] = useState(
    true,
  );

  const [
    agregando,
    setAgregando,
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

  const [
    seleccionados,
    setSeleccionados,
  ] = useState<
    RecursoSeleccionado[]
  >(
    [],
  );

  useEffect(() => {
    let activo =
      true;

    async function cargarRecursos() {
      setCargando(
        true,
      );

      setError(
        null,
      );

      try {
        if (
          pestana ===
          'FOTOGRAFIA'
        ) {
          const respuesta =
            await listarFotografiasProyecto(
              idProyecto,
              {
                pagina,
                limite:
                  LIMITE_POR_PAGINA,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          setFotografias(
            respuesta.fotografias,
          );

          setTotalPaginas(
            Math.max(
              1,
              respuesta.total_paginas,
            ),
          );

          return;
        }

        if (
          pestana ===
          'PANORAMICA'
        ) {
          const respuesta =
            await listarPanoramicasProyecto(
              idProyecto,
              {
                pagina,
                limite:
                  LIMITE_POR_PAGINA,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          setPanoramicas(
            respuesta.panoramicas,
          );

          setTotalPaginas(
            Math.max(
              1,
              respuesta.total_paginas,
            ),
          );

          return;
        }

        const respuesta =
          await listarPlanosProyecto(
            idProyecto,
            {
              pagina,
              limite:
                LIMITE_POR_PAGINA,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        setPlanos(
          respuesta.planos,
        );

        setTotalPaginas(
          Math.max(
            1,
            respuesta.total_paginas,
          ),
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
            'No fue posible cargar los recursos del proyecto.',
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

    void cargarRecursos();

    return () => {
      activo =
        false;
    };
  }, [
    idProyecto,
    pestana,
    pagina,
  ]);

  useEffect(() => {
    function manejarEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        !agregando
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
    agregando,
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

  const recursos =
    useMemo<
      RecursoProyecto[]
    >(
      () => {
        if (
          pestana ===
          'FOTOGRAFIA'
        ) {
          return fotografias;
        }

        if (
          pestana ===
          'PANORAMICA'
        ) {
          return panoramicas;
        }

        return planos;
      },
      [
        pestana,
        fotografias,
        panoramicas,
        planos,
      ],
    );

  function cambiarPestana(
    nuevaPestana:
      TipoPestana,
  ) {
    if (
      agregando ||
      nuevaPestana ===
        pestana
    ) {
      return;
    }

    setPestana(
      nuevaPestana,
    );

    setPagina(
      1,
    );

    setError(
      null,
    );
  }

  function estaSeleccionado(
    tipo:
      TipoRecursoCarpeta,
    idRecurso:
      string,
  ) {
    return seleccionados.some(
      (
        seleccionado,
      ) =>
        seleccionado.tipo ===
          tipo &&
        seleccionado.idRecurso ===
          idRecurso,
    );
  }

  function alternarSeleccion(
    recurso:
      RecursoProyecto,
  ) {
    if (
      agregando
    ) {
      return;
    }

    const idRecurso =
      obtenerIdRecurso(
        pestana,
        recurso,
      );

    const tipo:
      TipoRecursoCarpeta =
      pestana;

    setSeleccionados(
      (
        actuales,
      ) => {
        const existe =
          actuales.some(
            (
              seleccionado,
            ) =>
              seleccionado.tipo ===
                tipo &&
              seleccionado.idRecurso ===
                idRecurso,
          );

        if (
          existe
        ) {
          return actuales.filter(
            (
              seleccionado,
            ) =>
              !(
                seleccionado.tipo ===
                  tipo &&
                seleccionado.idRecurso ===
                  idRecurso
              ),
          );
        }

        return [
          ...actuales,
          {
            tipo,
            idRecurso,
          },
        ];
      },
    );
  }

  async function agregarSeleccionados() {
    if (
      agregando ||
      seleccionados.length ===
        0
    ) {
      return;
    }

    setAgregando(
      true,
    );

    setError(
      null,
    );

    try {
      for (
        const recurso of
        seleccionados
      ) {
        await agregarRecursoCarpeta(
          idProyecto,
          idCarpeta,
          {
            tipo:
              recurso.tipo,

            id_recurso:
              recurso.idRecurso,
          },
        );
      }

      onAgregados();
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
          'No fue posible agregar los recursos seleccionados.',
        );
      }
    } finally {
      setAgregando(
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
      !agregando
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
        aria-labelledby="add-folder-resources-title"
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

              <path d="M12 10v5" />

              <path d="M9.5 12.5h5" />
            </svg>
          </div>

          <div
            className={
              styles.headerText
            }
          >
            <h2
              id="add-folder-resources-title"
            >
              Agregar recursos
            </h2>

            <p>
              Selecciona recursos existentes para{' '}
              <strong>
                {nombreCarpeta}
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
              agregando
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
            styles.tabs
          }
          role="tablist"
          aria-label="Tipos de recursos"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              pestana ===
              'FOTOGRAFIA'
            }
            className={
              pestana ===
              'FOTOGRAFIA'
                ? styles.tabActive
                : styles.tab
            }
            onClick={() => {
              cambiarPestana(
                'FOTOGRAFIA',
              );
            }}
          >
            Fotografías
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              pestana ===
              'PANORAMICA'
            }
            className={
              pestana ===
              'PANORAMICA'
                ? styles.tabActive
                : styles.tab
            }
            onClick={() => {
              cambiarPestana(
                'PANORAMICA',
              );
            }}
          >
            Panorámicas 360°
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              pestana ===
              'PLANO'
            }
            className={
              pestana ===
              'PLANO'
                ? styles.tabActive
                : styles.tab
            }
            onClick={() => {
              cambiarPestana(
                'PLANO',
              );
            }}
          >
            Planos
          </button>
        </div>

        <div
          className={
            styles.body
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
                Cargando recursos...
              </strong>
            </div>
          ) : error &&
            recursos.length ===
              0 ? (
            <div
              className={
                styles.state
              }
              role="alert"
            >
              <strong>
                No fue posible cargar los recursos
              </strong>

              <p>
                {error}
              </p>
            </div>
          ) : recursos.length ===
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
                  <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" />

                  <path d="m7 16 3.5-4 2.5 3 1.8-2 2.2 3" />
                </svg>
              </div>

              <strong>
                No hay recursos disponibles
              </strong>

              <p>
                Primero agrega recursos desde su sección correspondiente del proyecto.
              </p>
            </div>
          ) : (
            <>
              <div
                className={
                  styles.resourceGrid
                }
              >
                {recursos.map(
                  (
                    recurso,
                  ) => {
                    const idRecurso =
                      obtenerIdRecurso(
                        pestana,
                        recurso,
                      );

                    const seleccionado =
                      estaSeleccionado(
                        pestana,
                        idRecurso,
                      );

                    return (
                      <button
                        key={
                          idRecurso
                        }
                        type="button"
                        className={
                          seleccionado
                            ? styles.resourceSelected
                            : styles.resource
                        }
                        onClick={() => {
                          alternarSeleccion(
                            recurso,
                          );
                        }}
                        disabled={
                          agregando
                        }
                        aria-pressed={
                          seleccionado
                        }
                      >
                        <div
                          className={
                            styles.preview
                          }
                        >
                          {pestana ===
                          'PLANO' ? (
                            <div
                              className={
                                styles.pdfPreview
                              }
                            >
                              <span>
                                PDF
                              </span>
                            </div>
                          ) : (
                            <img
                              src={
                                recurso.url
                              }
                              alt=""
                              loading="lazy"
                            />
                          )}

                          {pestana ===
                            'PANORAMICA' && (
                            <span
                              className={
                                styles.badge360
                              }
                            >
                              360°
                            </span>
                          )}

                          <span
                            className={
                              styles.check
                            }
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        </div>

                        <div
                          className={
                            styles.resourceInfo
                          }
                        >
                          <strong
                            title={
                              recurso.titulo
                            }
                          >
                            {
                              recurso.titulo
                            }
                          </strong>

                          <span>
                            {pestana ===
                            'FOTOGRAFIA'
                              ? 'Fotografía'
                              : pestana ===
                                  'PANORAMICA'
                                ? 'Panorámica 360°'
                                : 'Plano PDF'}
                          </span>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>

              {totalPaginas >
                1 && (
                <div
                  className={
                    styles.pagination
                  }
                >
                  <button
                    type="button"
                    disabled={
                      pagina <=
                        1 ||
                      cargando ||
                      agregando
                    }
                    onClick={() => {
                      setPagina(
                        (
                          actual,
                        ) =>
                          Math.max(
                            1,
                            actual -
                              1,
                          ),
                      );
                    }}
                  >
                    Anterior
                  </button>

                  <span>
                    Página{' '}
                    {pagina}{' '}
                    de{' '}
                    {
                      totalPaginas
                    }
                  </span>

                  <button
                    type="button"
                    disabled={
                      pagina >=
                        totalPaginas ||
                      cargando ||
                      agregando
                    }
                    onClick={() => {
                      setPagina(
                        (
                          actual,
                        ) =>
                          Math.min(
                            totalPaginas,
                            actual +
                              1,
                          ),
                      );
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}

          {error &&
            recursos.length >
              0 && (
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
          <div
            className={
              styles.selectionCount
            }
          >
            {seleccionados.length ===
            0
              ? 'Ningún recurso seleccionado'
              : `${seleccionados.length} ${
                  seleccionados.length ===
                  1
                    ? 'recurso seleccionado'
                    : 'recursos seleccionados'
                }`}
          </div>

          <div
            className={
              styles.footerActions
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
                agregando
              }
            >
              Cancelar
            </button>

            <button
              className={
                styles.addButton
              }
              type="button"
              onClick={() => {
                void agregarSeleccionados();
              }}
              disabled={
                agregando ||
                seleccionados.length ===
                  0
              }
            >
              {agregando
                ? 'Agregando...'
                : 'Agregar seleccionados'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}