import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  obtenerProyecto,
} from '../../api/proyectos.api';

import {
  establecerPortadaProyecto,
  listarFotografiasProyecto,
} from '../../api/fotografias.api';

import {
  listarPanoramicasProyecto,
} from '../../api/panoramicas.api';

import {
  CollaboratorsModal,
} from '../../components/CollaboratorsModal/CollaboratorsModal';

import {
  UploadPhotoModal,
} from '../../components/UploadPhotoModal/UploadPhotoModal';

import {
  UploadPanoramaModal,
} from '../../components/UploadPanoramaModal/UploadPanoramaModal';

import {
  PanoramaViewer,
} from '../../components/PanoramaViewer/PanoramaViewer';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import type {
  PanoramicaProyecto,
} from '../../types/panoramica';

import type {
  Proyecto,
} from '../../types/proyecto';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './ProjectDetailPage.module.css';

interface ProjectDetailPageProps {
  idProyecto: string;

  idUsuarioActual: string;

  onVolver: () => void;
}

type SeccionProyecto =
  | 'resumen'
  | 'fotografias'
  | 'planos'
  | '360'
  | 'mapa'
  | 'carpetas';

function formatearEstado(
  estado:
    Proyecto['estado_proyecto'],
): string {
  if (
    estado ===
    'ACTIVA'
  ) {
    return 'Activo';
  }

  if (
    estado ===
    'PAUSA'
  ) {
    return 'En pausa';
  }

  return 'Finalizado';
}

function formatearFecha(
  fecha:
    string | null,
): string {
  if (!fecha) {
    return 'Sin definir';
  }

  const fechaNormalizada =
    new Date(
      `${fecha}T00:00:00`,
    );

  if (
    Number.isNaN(
      fechaNormalizada.getTime(),
    )
  ) {
    return fecha;
  }

  return new Intl.DateTimeFormat(
    'es-CO',
    {
      day:
        'numeric',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    fechaNormalizada,
  );
}

export function ProjectDetailPage({
  idProyecto,
  idUsuarioActual,
  onVolver,
}: ProjectDetailPageProps) {
  const [
    proyecto,
    setProyecto,
  ] =
    useState<Proyecto | null>(
      null,
    );

  const [
    fotografias,
    setFotografias,
  ] = useState<
    FotografiaProyecto[]
  >([]);

  const [
    panoramicas,
    setPanoramicas,
  ] = useState<
    PanoramicaProyecto[]
  >([]);

  const [
    cargando,
    setCargando,
  ] = useState(
    true,
  );

  const [
    cargandoFotografias,
    setCargandoFotografias,
  ] = useState(
    true,
  );

  const [
    cargandoPanoramicas,
    setCargandoPanoramicas,
  ] = useState(
    true,
  );

  const [
    cambiandoPortada,
    setCambiandoPortada,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    errorFotografias,
    setErrorFotografias,
  ] = useState<
    string | null
  >(null);

  const [
    errorPanoramicas,
    setErrorPanoramicas,
  ] = useState<
    string | null
  >(null);

  const [
    mostrandoColaboradores,
    setMostrandoColaboradores,
  ] = useState(
    false,
  );

  const [
    mostrandoMenuSubida,
    setMostrandoMenuSubida,
  ] = useState(
    false,
  );

  const [
    archivoFotografia,
    setArchivoFotografia,
  ] = useState<
    File | null
  >(null);

  const [
    archivoPanoramica,
    setArchivoPanoramica,
  ] = useState<
    File | null
  >(null);

  const [
    panoramicaAbierta,
    setPanoramicaAbierta,
  ] = useState<
    PanoramicaProyecto | null
  >(null);

  const [
    seccionActiva,
    setSeccionActiva,
  ] =
    useState<SeccionProyecto>(
      'resumen',
    );

  const inputFotografiaRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const inputPanoramicaRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  useEffect(() => {
    let activa =
      true;

    async function cargarProyecto() {
      setCargando(
        true,
      );

      setError(
        null,
      );

      try {
        const respuesta =
          await obtenerProyecto(
            idProyecto,
          );

        if (
          !activa
        ) {
          return;
        }

        setProyecto(
          respuesta,
        );
      } catch (
        errorObtenido
      ) {
        if (
          !activa
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
            'No fue posible cargar el proyecto.',
          );
        }
      } finally {
        if (
          activa
        ) {
          setCargando(
            false,
          );
        }
      }
    }

    void cargarProyecto();

    return () => {
      activa =
        false;
    };
  }, [
    idProyecto,
  ]);

  useEffect(() => {
    let activa =
      true;

    async function cargarFotografias() {
      setCargandoFotografias(
        true,
      );

      setErrorFotografias(
        null,
      );

      try {
        const respuesta =
          await listarFotografiasProyecto(
            idProyecto,
            {
              pagina:
                1,

              limite:
                50,
            },
          );

        if (
          !activa
        ) {
          return;
        }

        setFotografias(
          respuesta.fotografias,
        );
      } catch (
        errorObtenido
      ) {
        if (
          !activa
        ) {
          return;
        }

        if (
          errorObtenido instanceof
          ApiError
        ) {
          setErrorFotografias(
            errorObtenido.message,
          );
        } else {
          setErrorFotografias(
            'No fue posible cargar las fotografías.',
          );
        }
      } finally {
        if (
          activa
        ) {
          setCargandoFotografias(
            false,
          );
        }
      }
    }

    void cargarFotografias();

    return () => {
      activa =
        false;
    };
  }, [
    idProyecto,
  ]);

  useEffect(() => {
    let activa =
      true;

    async function cargarPanoramicas() {
      setCargandoPanoramicas(
        true,
      );

      setErrorPanoramicas(
        null,
      );

      try {
        const respuesta =
          await listarPanoramicasProyecto(
            idProyecto,
            {
              pagina:
                1,

              limite:
                20,
            },
          );

        if (
          !activa
        ) {
          return;
        }

        setPanoramicas(
          respuesta.panoramicas,
        );
      } catch (
        errorObtenido
      ) {
        if (
          !activa
        ) {
          return;
        }

        if (
          errorObtenido instanceof
          ApiError
        ) {
          setErrorPanoramicas(
            errorObtenido.message,
          );
        } else {
          setErrorPanoramicas(
            'No fue posible cargar las panorámicas 360°.',
          );
        }
      } finally {
        if (
          activa
        ) {
          setCargandoPanoramicas(
            false,
          );
        }
      }
    }

    void cargarPanoramicas();

    return () => {
      activa =
        false;
    };
  }, [
    idProyecto,
  ]);

  function seleccionarArchivoFotografia(
    archivo:
      File,
  ) {
    setErrorFotografias(
      null,
    );

    setArchivoFotografia(
      archivo,
    );
  }

  function seleccionarArchivoPanoramica(
    archivo:
      File,
  ) {
    setErrorPanoramicas(
      null,
    );

    setArchivoPanoramica(
      archivo,
    );
  }

  function fotografiaSubida(
    nuevaFotografia:
      FotografiaProyecto,
  ) {
    setFotografias(
      (
        actuales,
      ) => [
        nuevaFotografia,
        ...actuales,
      ],
    );

    setArchivoFotografia(
      null,
    );

    setErrorFotografias(
      null,
    );

    setSeccionActiva(
      'fotografias',
    );
  }

  function panoramicaSubida(
    nuevaPanoramica:
      PanoramicaProyecto,
  ) {
    setPanoramicas(
      (
        actuales,
      ) => [
        nuevaPanoramica,
        ...actuales,
      ],
    );

    setArchivoPanoramica(
      null,
    );

    setErrorPanoramicas(
      null,
    );

    setSeccionActiva(
      '360',
    );
  }

  function cerrarModalFotografia() {
    setArchivoFotografia(
      null,
    );
  }

  function cerrarModalPanoramica() {
    setArchivoPanoramica(
      null,
    );
  }

  async function establecerPortada(
    fotografia:
      FotografiaProyecto,
  ) {
    if (
      cambiandoPortada !==
      null
    ) {
      return;
    }

    setCambiandoPortada(
      fotografia.id_fotografia,
    );

    setErrorFotografias(
      null,
    );

    try {
      const actualizada =
        await establecerPortadaProyecto(
          idProyecto,
          fotografia.id_fotografia,
        );

      setFotografias(
        (
          actuales,
        ) =>
          actuales.map(
            (
              actual,
            ) => ({
              ...actual,

              es_portada:
                actual.id_fotografia ===
                actualizada.id_fotografia,
            }),
          ),
      );
    } catch (
      errorObtenido
    ) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setErrorFotografias(
          errorObtenido.message,
        );
      } else {
        setErrorFotografias(
          'No fue posible establecer la portada.',
        );
      }
    } finally {
      setCambiandoPortada(
        null,
      );
    }
  }

  if (
    cargando
  ) {
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
        >
          <div
            className={
              styles.spinner
            }
          />

          <strong>
            Cargando proyecto...
          </strong>
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
          ← Volver a proyectos
        </button>

        <div
          className={
            styles.state
          }
        >
          <strong>
            No pudimos cargar el proyecto
          </strong>

          <span>
            {
              error
            }
          </span>
        </div>
      </section>
    );
  }

  const esPropietario =
    proyecto.id_propietario ===
    idUsuarioActual;

  const portada =
    fotografias.find(
      (
        fotografia,
      ) =>
        fotografia.es_portada,
    ) ?? null;

  const fotografiasRecientes =
    fotografias.slice(
      0,
      4,
    );

  return (
    <>
      <section
        className={
          styles.page
        }
      >
        <nav
          className={
            styles.breadcrumb
          }
          aria-label="Ruta"
        >
          <button
            type="button"
            onClick={
              onVolver
            }
          >
            Proyectos
          </button>

          <span>
            /
          </span>

          <strong>
            {
              proyecto.nombre
            }
          </strong>
        </nav>

        <div
          className={
            styles.hero
          }
        >
          <div
            className={
              styles.heroInfo
            }
          >
            <div
              className={
                styles.titleRow
              }
            >
              <h1>
                {
                  proyecto.nombre
                }
              </h1>

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
            </div>

            <div
              className={
                styles.location
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
                />

                <circle
                  cx="12"
                  cy="9"
                  r="2"
                />
              </svg>

              <span>
                {
                  proyecto.direccion
                }
              </span>
            </div>

            <p
              className={
                styles.description
              }
            >
              {
                proyecto.descripcion
              }
            </p>

            <div
              className={
                styles.projectMeta
              }
            >
              <div>
                <span>
                  Inicio
                </span>

                <strong>
                  {formatearFecha(
                    proyecto.fecha_inicio,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Finalización
                </span>

                <strong>
                  {formatearFecha(
                    proyecto.fecha_finalizacion,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Contratante
                </span>

                <strong>
                  {
                    proyecto.contratante
                  }
                </strong>
              </div>
            </div>
          </div>

          <div
            className={
              styles.heroImage
            }
          >
            {portada ? (
              <img
                src={
                  portada.url
                }
                alt={`Portada de ${proyecto.nombre}`}
              />
            ) : (
              <div
                className={
                  styles.emptyCover
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

                <strong>
                  Sin portada
                </strong>

                <span>
                  Sube una fotografía y selecciónala como portada.
                </span>
              </div>
            )}
          </div>

          <div
            className={
              styles.heroActions
            }
          >
            <div
              className={
                styles.uploadWrapper
              }
            >
              <button
                className={
                  styles.primaryButton
                }
                type="button"
                onClick={() => {
                  setMostrandoMenuSubida(
                    (
                      actual,
                    ) =>
                      !actual,
                  );
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 16V4"
                  />

                  <path
                    d="m7 9 5-5 5 5"
                  />

                  <path
                    d="M5 20h14"
                  />
                </svg>

                <span>
                  Subir contenido
                </span>

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="m7 10 5 5 5-5"
                  />
                </svg>
              </button>

              {mostrandoMenuSubida && (
                <div
                  className={
                    styles.uploadMenu
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoMenuSubida(
                        false,
                      );

                      inputFotografiaRef.current?.click();
                    }}
                  >
                    <span>
                      Fotografía
                    </span>

                    <small>
                      Imagen del proyecto
                    </small>
                  </button>

                  <button
                    type="button"
                    disabled
                  >
                    <span>
                      Plano
                    </span>

                    <small>
                      Próximamente
                    </small>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoMenuSubida(
                        false,
                      );

                      inputPanoramicaRef.current?.click();
                    }}
                  >
                    <span>
                      Recorrido 360°
                    </span>

                    <small>
                      Imagen panorámica equirectangular
                    </small>
                  </button>
                </div>
              )}

              <input
                ref={
                  inputFotografiaRef
                }
                className={
                  styles.hiddenInput
                }
                type="file"
                accept="image/*"
                onChange={(
                  event,
                ) => {
                  const archivo =
                    event.target.files?.[0];

                  if (
                    archivo
                  ) {
                    seleccionarArchivoFotografia(
                      archivo,
                    );
                  }

                  event.currentTarget.value =
                    '';
                }}
              />

              <input
                ref={
                  inputPanoramicaRef
                }
                className={
                  styles.hiddenInput
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(
                  event,
                ) => {
                  const archivo =
                    event.target.files?.[0];

                  if (
                    archivo
                  ) {
                    seleccionarArchivoPanoramica(
                      archivo,
                    );
                  }

                  event.currentTarget.value =
                    '';
                }}
              />
            </div>

            {esPropietario && (
              <>
                <button
                  className={
                    styles.secondaryButton
                  }
                  type="button"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"
                    />

                    <path
                      d="m13.5 6.5 3.5 3.5"
                    />
                  </svg>

                  Editar proyecto
                </button>

                <button
                  className={
                    styles.secondaryButton
                  }
                  type="button"
                  onClick={() => {
                    setMostrandoColaboradores(
                      true,
                    );
                  }}
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

                    <path
                      d="M3 20a6 6 0 0 1 12 0"
                    />

                    <path
                      d="M18 8v6"
                    />

                    <path
                      d="M15 11h6"
                    />
                  </svg>

                  Agregar colaborador
                </button>
              </>
            )}
          </div>
        </div>

        <nav
          className={
            styles.tabs
          }
          aria-label="Secciones del proyecto"
        >
          {[
            [
              'resumen',
              'Resumen',
            ],
            [
              'fotografias',
              'Fotografías',
            ],
            [
              'planos',
              'Planos',
            ],
            [
              '360',
              '360°',
            ],
            [
              'mapa',
              'Mapa',
            ],
            [
              'carpetas',
              'Carpetas',
            ],
          ].map(
            ([
              valor,
              etiqueta,
            ]) => (
              <button
                key={
                  valor
                }
                type="button"
                className={
                  seccionActiva ===
                  valor
                    ? styles.tabActive
                    : undefined
                }
                onClick={() => {
                  setSeccionActiva(
                    valor as SeccionProyecto,
                  );
                }}
              >
                {
                  etiqueta
                }
              </button>
            ),
          )}
        </nav>

        {errorFotografias && (
          <div
            className={
              styles.inlineError
            }
            role="alert"
          >
            {
              errorFotografias
            }
          </div>
        )}

        {errorPanoramicas && (
          <div
            className={
              styles.inlineError
            }
            role="alert"
          >
            {
              errorPanoramicas
            }
          </div>
        )}

        {seccionActiva ===
          'resumen' && (
          <div
            className={
              styles.summaryGrid
            }
          >
            <section
              className={
                styles.card
              }
            >
              <div
                className={
                  styles.cardHeader
                }
              >
                <div>
                  <h2>
                    Fotografías recientes
                  </h2>

                  <p>
                    Últimos registros visuales del proyecto.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSeccionActiva(
                      'fotografias',
                    );
                  }}
                >
                  Ver todas
                </button>
              </div>

              {cargandoFotografias ? (
                <div
                  className={
                    styles.emptySection
                  }
                >
                  Cargando fotografías...
                </div>
              ) : fotografiasRecientes.length ===
                0 ? (
                <div
                  className={
                    styles.emptySection
                  }
                >
                  Todavía no hay fotografías en este proyecto.
                </div>
              ) : (
                <div
                  className={
                    styles.photoGrid
                  }
                >
                  {fotografiasRecientes.map(
                    (
                      fotografia,
                    ) => (
                      <div
                        key={
                          fotografia.id_fotografia
                        }
                        className={
                          styles.photoCard
                        }
                      >
                        <img
                          src={
                            fotografia.url
                          }
                          alt={
                            fotografia.titulo
                          }
                        />

                        <div>
                          <strong>
                            {
                              fotografia.titulo
                            }
                          </strong>

                          {fotografia.es_portada && (
                            <span>
                              Portada
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            <section
              className={
                styles.card
              }
            >
              <div
                className={
                  styles.cardHeader
                }
              >
                <div>
                  <h2>
                    Información
                  </h2>

                  <p>
                    Datos generales del proyecto.
                  </p>
                </div>
              </div>

              <dl
                className={
                  styles.infoList
                }
              >
                <div>
                  <dt>
                    Estado
                  </dt>

                  <dd>
                    {formatearEstado(
                      proyecto.estado_proyecto,
                    )}
                  </dd>
                </div>

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
              </dl>
            </section>
          </div>
        )}

        {seccionActiva ===
          'fotografias' && (
          <section
            className={
              styles.card
            }
          >
            <div
              className={
                styles.cardHeader
              }
            >
              <div>
                <h2>
                  Fotografías
                </h2>

                <p>
                  Evidencia visual asociada al proyecto.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  inputFotografiaRef.current?.click();
                }}
              >
                Subir fotografía
              </button>
            </div>

            {cargandoFotografias ? (
              <div
                className={
                  styles.emptySection
                }
              >
                Cargando fotografías...
              </div>
            ) : fotografias.length ===
              0 ? (
              <div
                className={
                  styles.emptySection
                }
              >
                No hay fotografías todavía.
              </div>
            ) : (
              <div
                className={
                  styles.galleryGrid
                }
              >
                {fotografias.map(
                  (
                    fotografia,
                  ) => (
                    <article
                      key={
                        fotografia.id_fotografia
                      }
                      className={
                        styles.galleryCard
                      }
                    >
                      <img
                        src={
                          fotografia.url
                        }
                        alt={
                          fotografia.titulo
                        }
                      />

                      <div
                        className={
                          styles.galleryInfo
                        }
                      >
                        <div>
                          <strong>
                            {
                              fotografia.titulo
                            }
                          </strong>

                          {fotografia.es_portada && (
                            <span
                              className={
                                styles.coverBadge
                              }
                            >
                              Portada
                            </span>
                          )}
                        </div>

                        {esPropietario &&
                          !fotografia.es_portada && (
                            <button
                              type="button"
                              disabled={
                                cambiandoPortada !==
                                null
                              }
                              onClick={() => {
                                void establecerPortada(
                                  fotografia,
                                );
                              }}
                            >
                              {cambiandoPortada ===
                              fotografia.id_fotografia
                                ? 'Guardando...'
                                : 'Usar como portada'}
                            </button>
                          )}
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        )}

        {seccionActiva ===
          'planos' && (
          <section
            className={
              styles.emptyContent
            }
          >
            <h2>
              Planos
            </h2>

            <p>
              Aquí conectaremos los planos del proyecto.
            </p>
          </section>
        )}

        {seccionActiva ===
          '360' && (
          <section
            className={
              styles.card
            }
          >
            <div
              className={
                styles.cardHeader
              }
            >
              <div>
                <h2>
                  Panorámicas 360°
                </h2>

                <p>
                  Recorridos visuales panorámicos del proyecto.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  inputPanoramicaRef.current?.click();
                }}
              >
                Subir panorámica
              </button>
            </div>

            {cargandoPanoramicas ? (
              <div
                className={
                  styles.emptySection
                }
              >
                Cargando panorámicas...
              </div>
            ) : panoramicas.length ===
              0 ? (
              <div
                className={
                  styles.emptySection
                }
              >
                Todavía no hay panorámicas 360° en este proyecto.
              </div>
            ) : (
              <div
                className={
                  styles.galleryGrid
                }
              >
                {panoramicas.map(
                  (
                    panoramica,
                  ) => (
                    <article
                      key={
                        panoramica.id_panoramica
                      }
                      className={
                        styles.galleryCard
                      }
                      role="button"
                      tabIndex={
                        0
                      }
                      aria-label={`Abrir panorámica 360° ${panoramica.titulo}`}
                      onClick={() => {
                        setPanoramicaAbierta(
                          panoramica,
                        );
                      }}
                      onKeyDown={(
                        event,
                      ) => {
                        if (
                          event.key ===
                            'Enter' ||
                          event.key ===
                            ' '
                        ) {
                          event.preventDefault();

                          setPanoramicaAbierta(
                            panoramica,
                          );
                        }
                      }}
                    >
                      <img
                        src={
                          panoramica.url
                        }
                        alt={
                          panoramica.titulo
                        }
                      />

                      <div
                        className={
                          styles.galleryInfo
                        }
                      >
                        <div>
                          <strong>
                            {
                              panoramica.titulo
                            }
                          </strong>

                          <span
                            className={
                              styles.coverBadge
                            }
                          >
                            360°
                          </span>
                        </div>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        )}

        {seccionActiva ===
          'mapa' && (
          <section
            className={
              styles.emptyContent
            }
          >
            <h2>
              Mapa
            </h2>

            <p>
              Aquí conectaremos el mapa específico del proyecto.
            </p>
          </section>
        )}

        {seccionActiva ===
          'carpetas' && (
          <section
            className={
              styles.emptyContent
            }
          >
            <h2>
              Carpetas
            </h2>

            <p>
              Aquí construiremos la organización documental del proyecto.
            </p>
          </section>
        )}
      </section>

      {mostrandoColaboradores && (
        <CollaboratorsModal
          idProyecto={
            proyecto.id_proyecto
          }
          onCerrar={() => {
            setMostrandoColaboradores(
              false,
            );
          }}
        />
      )}

      {archivoFotografia && (
        <UploadPhotoModal
          idProyecto={
            proyecto.id_proyecto
          }
          archivo={
            archivoFotografia
          }
          latitudProyecto={
            proyecto.latitud
          }
          longitudProyecto={
            proyecto.longitud
          }
          onCerrar={
            cerrarModalFotografia
          }
          onSubidaCompleta={
            fotografiaSubida
          }
        />
      )}

      {archivoPanoramica && (
        <UploadPanoramaModal
          idProyecto={
            proyecto.id_proyecto
          }
          archivo={
            archivoPanoramica
          }
          latitudProyecto={
            proyecto.latitud
          }
          longitudProyecto={
            proyecto.longitud
          }
          onCerrar={
            cerrarModalPanoramica
          }
          onSubidaCompleta={
            panoramicaSubida
          }
        />
      )}

      {panoramicaAbierta && (
        <PanoramaViewer
          url={
            panoramicaAbierta.url
          }
          titulo={
            panoramicaAbierta.titulo
          }
          onCerrar={() => {
            setPanoramicaAbierta(
              null,
            );
          }}
        />
      )}
    </>
  );
}