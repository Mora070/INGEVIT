import {
  useEffect,
  useState,
} from 'react';

import {
  listarCarpetasProyecto,
  obtenerContenidoCarpeta,
  quitarRecursoCarpeta,
  agregarRecursoCarpeta,
} from '../../api/carpetas.api';

import type {
  CarpetaProyecto,
  FotografiaCarpeta,
  PanoramicaCarpeta,
  PlanoCarpeta,
} from '../../types/carpeta';
import {
  ApiError,
} from '../../../../shared/api/http';

import {
  CreateFolderModal,
} from '../CreateFolderModal/CreateFolderModal';

import {
  RemoveFolderResourceModal,
} from '../RemoveFolderResourceModal/RemoveFolderResourceModal';

import {
  FolderContextMenu,
} from '../FolderContextMenu/FolderContextMenu';

import {
  ResourceContextMenu,
} from '../ResourceContextMenu/ResourceContextMenu';

import {
  RenameFolderModal,
} from '../RenameFolderModal/RenameFolderModal';

import {
  DeleteFolderModal,
} from '../DeleteFolderModal/DeleteFolderModal';

import {
  MoveFolderModal,
} from '../MoveFolderModal/MoveFolderModal';

import {
  MoveFolderResourceModal,
} from '../MoveFolderResourceModal/MoveFolderResourceModal';

import { AddFolderResourcesModal } from '../AddFolderResourcesModal/AddFolderResourcesModal';

import styles from './ProjectFolders.module.css';

interface ProjectFoldersProps {
  idProyecto: string;
  versionCarpetas: number;
  onAbrirFotografia: (
    fotografia: FotografiaCarpeta,
  ) => void;
  onAbrirPanoramica: (
    panoramica: PanoramicaCarpeta,
  ) => void;
  onAbrirPlano: (
    plano: PlanoCarpeta,
  ) => void;
}

interface PosicionMenuContextual {
  x: number;
  y: number;
}

interface MenuCarpetaContextual
  extends PosicionMenuContextual {
  carpeta: CarpetaProyecto;
}

type RecursoCarpetaContextual =
  | {
    tipo: 'FOTOGRAFIA';
    recurso: FotografiaCarpeta;
  }
  | {
    tipo: 'PANORAMICA';
    recurso: PanoramicaCarpeta;
  }
  | {
    tipo: 'PLANO';
    recurso: PlanoCarpeta;
  };

interface MenuRecursoContextual
  extends PosicionMenuContextual {
  recurso: RecursoCarpetaContextual;
}

export function ProjectFolders({
  idProyecto,
  versionCarpetas,
  onAbrirFotografia,
  onAbrirPanoramica,
  onAbrirPlano,
}: ProjectFoldersProps) {
  const [
    carpetas,
    setCarpetas,
  ] = useState<CarpetaProyecto[]>(
    [],
  );

  const [
    fotografias,
    setFotografias,
  ] = useState<FotografiaCarpeta[]>(
    [],
  );

  const [
    panoramicas,
    setPanoramicas,
  ] = useState<PanoramicaCarpeta[]>(
    [],
  );

  const [
    planos,
    setPlanos,
  ] = useState<PlanoCarpeta[]>(
    [],
  );

  const [
    agregandoRecursos,
    setAgregandoRecursos,
  ] = useState(
    false,
  );

  const [
    rutaCarpetas,
    setRutaCarpetas,
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
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    creandoCarpeta,
    setCreandoCarpeta,
  ] = useState(
    false,
  );

  const [
    idPadreNuevaCarpeta,
    setIdPadreNuevaCarpeta,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    menuVacio,
    setMenuVacio,
  ] = useState<
    PosicionMenuContextual | null
  >(
    null,
  );

  const [
    menuCarpeta,
    setMenuCarpeta,
  ] = useState<
    MenuCarpetaContextual | null
  >(
    null,
  );

  const [
    menuRecurso,
    setMenuRecurso,
  ] = useState<
    MenuRecursoContextual | null
  >(
    null,
  );

  const [
    recursoAQuitar,
    setRecursoAQuitar,
  ] = useState<RecursoCarpetaContextual | null>(
    null,
  );

  const [
    recursoAMover,
    setRecursoAMover,
  ] = useState<RecursoCarpetaContextual | null>(
    null,
  );

  const [
    moviendoRecurso,
    setMoviendoRecurso,
  ] = useState(
    false,
  );

  const [
    errorMoverRecurso,
    setErrorMoverRecurso,
  ] = useState<string | null>(
    null,
  );

  const [
    quitandoRecurso,
    setQuitandoRecurso,
  ] = useState(
    false,
  );

  const [
    errorQuitarRecurso,
    setErrorQuitarRecurso,
  ] = useState<string | null>(
    null,
  );

  const [
    carpetaRenombrando,
    setCarpetaRenombrando,
  ] = useState<
    CarpetaProyecto | null
  >(
    null,
  );

  const [
    carpetaEliminando,
    setCarpetaEliminando,
  ] = useState<
    CarpetaProyecto | null
  >(
    null,
  );

  const [
    carpetaMoviendo,
    setCarpetaMoviendo,
  ] = useState<
    CarpetaProyecto | null
  >(
    null,
  );

  const carpetaActual =
    rutaCarpetas.length > 0
      ? rutaCarpetas[
      rutaCarpetas.length - 1
      ]
      : null;

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

      setRutaCarpetas(
        [],
      );

      setFotografias(
        [],
      );

      setPanoramicas(
        [],
      );

      setPlanos(
        [],
      );

      setMenuVacio(
        null,
      );

      setMenuCarpeta(
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
          respuesta,
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
  ]);

  useEffect(() => {
    if (
      versionCarpetas === 0
    ) {
      return;
    }

    let activo =
      true;

    async function actualizarCarpetas() {
      try {
        if (
          carpetaActual
        ) {
          const contenido =
            await obtenerContenidoCarpeta(
              idProyecto,
              carpetaActual.id_carpeta,
            );

          if (
            !activo
          ) {
            return;
          }

          setCarpetas(
            contenido.subcarpetas,
          );

          setFotografias(
            contenido.fotografias,
          );

          setPanoramicas(
            contenido.panoramicas,
          );

          setPlanos(
            contenido.planos,
          );

          setRutaCarpetas((
            rutaActual,
          ) =>
            rutaActual.map(
              (
                carpeta,
              ) =>
                carpeta.id_carpeta ===
                  contenido.carpeta.id_carpeta
                  ? contenido.carpeta
                  : carpeta,
            ),
          );

          return;
        }

        const carpetasRaiz =
          await listarCarpetasProyecto(
            idProyecto,
            null,
          );

        if (
          !activo
        ) {
          return;
        }

        setCarpetas(
          carpetasRaiz,
        );
      } catch {
        /*
         * Es una actualización silenciosa en tiempo real.
         * Conservamos el contenido que ya está visible.
         */
      }
    }

    void actualizarCarpetas();

    return () => {
      activo =
        false;
    };
  }, [
    versionCarpetas,
  ]);

  async function quitarRecurso(
    seleccionado: RecursoCarpetaContextual,
  ) {
    if (
      !carpetaActual ||
      quitandoRecurso
    ) {
      return;
    }

    setQuitandoRecurso(
      true,
    );

    setErrorQuitarRecurso(
      null,
    );

    try {
      if (
        seleccionado.tipo ===
        'FOTOGRAFIA'
      ) {
        await quitarRecursoCarpeta(
          idProyecto,
          carpetaActual.id_carpeta,
          seleccionado.tipo,
          seleccionado.recurso.id_fotografia,
        );

        setFotografias((
          actuales,
        ) =>
          actuales.filter(
            (
              fotografia,
            ) =>
              fotografia.id_fotografia !==
              seleccionado.recurso.id_fotografia,
          ),
        );
      } else if (
        seleccionado.tipo ===
        'PANORAMICA'
      ) {
        await quitarRecursoCarpeta(
          idProyecto,
          carpetaActual.id_carpeta,
          seleccionado.tipo,
          seleccionado.recurso.id_panoramica,
        );

        setPanoramicas((
          actuales,
        ) =>
          actuales.filter(
            (
              panoramica,
            ) =>
              panoramica.id_panoramica !==
              seleccionado.recurso.id_panoramica,
          ),
        );
      } else {
        await quitarRecursoCarpeta(
          idProyecto,
          carpetaActual.id_carpeta,
          seleccionado.tipo,
          seleccionado.recurso.id_plano,
        );

        setPlanos((
          actuales,
        ) =>
          actuales.filter(
            (
              plano,
            ) =>
              plano.id_plano !==
              seleccionado.recurso.id_plano,
          ),
        );
      }

      setRecursoAQuitar(
        null,
      );
    } catch (
    errorObtenido
    ) {
      setErrorQuitarRecurso(
        errorObtenido instanceof ApiError
          ? errorObtenido.message
          : 'No fue posible quitar el recurso de la carpeta.',
      );
    } finally {
      setQuitandoRecurso(
        false,
      );
    }
  }

  async function moverRecurso(
    seleccionado: RecursoCarpetaContextual,
    idCarpetaDestino: string,
  ) {
    if (
      !carpetaActual ||
      moviendoRecurso
    ) {
      return;
    }

    setMoviendoRecurso(
      true,
    );

    setErrorMoverRecurso(
      null,
    );

    try {
      let idRecurso: string;

      if (
        seleccionado.tipo ===
        'FOTOGRAFIA'
      ) {
        idRecurso =
          seleccionado.recurso.id_fotografia;
      } else if (
        seleccionado.tipo ===
        'PANORAMICA'
      ) {
        idRecurso =
          seleccionado.recurso.id_panoramica;
      } else {
        idRecurso =
          seleccionado.recurso.id_plano;
      }

      await agregarRecursoCarpeta(
        idProyecto,
        idCarpetaDestino,
        {
          tipo:
            seleccionado.tipo,
          id_recurso:
            idRecurso,
        },
      );

      if (
        seleccionado.tipo ===
        'FOTOGRAFIA'
      ) {
        setFotografias((
          actuales,
        ) =>
          actuales.filter(
            (
              fotografia,
            ) =>
              fotografia.id_fotografia !==
              seleccionado.recurso.id_fotografia,
          ),
        );
      } else if (
        seleccionado.tipo ===
        'PANORAMICA'
      ) {
        setPanoramicas((
          actuales,
        ) =>
          actuales.filter(
            (
              panoramica,
            ) =>
              panoramica.id_panoramica !==
              seleccionado.recurso.id_panoramica,
          ),
        );
      } else {
        setPlanos((
          actuales,
        ) =>
          actuales.filter(
            (
              plano,
            ) =>
              plano.id_plano !==
              seleccionado.recurso.id_plano,
          ),
        );
      }

      setRecursoAMover(
        null,
      );
    } catch (
    errorObtenido
    ) {
      setErrorMoverRecurso(
        errorObtenido instanceof ApiError
          ? errorObtenido.message
          : 'No fue posible mover el recurso.',
      );
    } finally {
      setMoviendoRecurso(
        false,
      );
    }
  }
  async function abrirCarpeta(
    carpeta: CarpetaProyecto,
  ) {
    setMenuVacio(
      null,
    );

    setMenuCarpeta(
      null,
    );

    setCargando(
      true,
    );

    setError(
      null,
    );

    try {
      const contenido =
        await obtenerContenidoCarpeta(
          idProyecto,
          carpeta.id_carpeta,
        );

      setCarpetas(
        contenido.subcarpetas,
      );

      setFotografias(
        contenido.fotografias,
      );

      setPanoramicas(
        contenido.panoramicas,
      );

      setPlanos(
        contenido.planos,
      );

      setRutaCarpetas(
        (
          rutaActual,
        ) => {
          const indiceExistente =
            rutaActual.findIndex(
              (
                elemento,
              ) =>
                elemento.id_carpeta ===
                contenido.carpeta.id_carpeta,
            );

          if (
            indiceExistente >= 0
          ) {
            return rutaActual.slice(
              0,
              indiceExistente + 1,
            );
          }

          return [
            ...rutaActual,
            contenido.carpeta,
          ];
        },
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
          'No fue posible abrir la carpeta.',
        );
      }
    } finally {
      setCargando(
        false,
      );
    }
  }

  async function volverInicio() {
    setMenuVacio(
      null,
    );

    setMenuCarpeta(
      null,
    );

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

      setCarpetas(
        respuesta,
      );

      setFotografias(
        [],
      );

      setPanoramicas(
        [],
      );

      setPlanos(
        [],
      );

      setRutaCarpetas(
        [],
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
          'No fue posible volver al inicio de las carpetas.',
        );
      }
    } finally {
      setCargando(
        false,
      );
    }
  }

  async function navegarBreadcrumb(
    carpeta: CarpetaProyecto,
    indice: number,
  ) {
    setMenuVacio(
      null,
    );

    setMenuCarpeta(
      null,
    );

    setCargando(
      true,
    );

    setError(
      null,
    );

    try {
      const contenido =
        await obtenerContenidoCarpeta(
          idProyecto,
          carpeta.id_carpeta,
        );

      setCarpetas(
        contenido.subcarpetas,
      );

      setFotografias(
        contenido.fotografias,
      );

      setPanoramicas(
        contenido.panoramicas,
      );

      setPlanos(
        contenido.planos,
      );

      setRutaCarpetas(
        (
          rutaActual,
        ) =>
          rutaActual.slice(
            0,
            indice + 1,
          ),
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
          'No fue posible abrir la ubicación seleccionada.',
        );
      }
    } finally {
      setCargando(
        false,
      );
    }
  }

  function abrirMenuVacio(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
  ) {
    if (
      cargando ||
      error
    ) {
      return;
    }

    const elemento =
      event.target as HTMLElement;

    if (
      elemento.closest(
        '[data-folder-card="true"]',
      )
    ) {
      return;
    }

    event.preventDefault();

    setMenuCarpeta(
      null,
    );

    setMenuVacio({
      x:
        event.clientX,
      y:
        event.clientY,
    });
  }

  function abrirMenuCarpeta(
    event:
      React.MouseEvent<
        HTMLElement
      >,
    carpeta: CarpetaProyecto,
  ) {
    event.preventDefault();

    event.stopPropagation();

    if (
      cargando
    ) {
      return;
    }

    setMenuVacio(
      null,
    );

    setMenuCarpeta({
      x:
        event.clientX,
      y:
        event.clientY,
      carpeta,
    });
  }

  function abrirModalNuevaCarpeta(
    idCarpetaPadre:
      string | null =
      carpetaActual?.id_carpeta ??
      null,
  ) {
    setMenuVacio(
      null,
    );

    setMenuCarpeta(
      null,
    );

    setIdPadreNuevaCarpeta(
      idCarpetaPadre,
    );

    setCreandoCarpeta(
      true,
    );
  }

  return (
    <section
      className={
        styles.folders
      }
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
          <h2>
            Carpetas
          </h2>

          <p>
            Organiza fotografías, panorámicas y planos del proyecto.
          </p>
        </div>

        <div
          className={
            styles.headerActions
          }
        >
          {carpetaActual && (
            <button
              className={
                styles.resourcesButton
              }
              type="button"
              onClick={() => {
                setAgregandoRecursos(
                  true,
                );
              }}
            >
              <span
                aria-hidden="true"
              >
                +
              </span>

              Agregar recursos
            </button>
          )}

          <button
            className={
              styles.createButton
            }
            type="button"
            onClick={() => {
              abrirModalNuevaCarpeta();
            }}
          >
            <span
              aria-hidden="true"
            >
              +
            </span>

            Nueva carpeta
          </button>
        </div>
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
          disabled={
            rutaCarpetas.length ===
            0
          }
          onClick={() => {
            void volverInicio();
          }}
        >
          Inicio
        </button>

        {rutaCarpetas.map(
          (
            carpeta,
            indice,
          ) => {
            const esActual =
              indice ===
              rutaCarpetas.length -
              1;

            return (
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
                    void navegarBreadcrumb(
                      carpeta,
                      indice,
                    );
                  }}
                  title={
                    carpeta.nombre
                  }
                >
                  {
                    carpeta.nombre
                  }
                </button>
              </div>
            );
          },
        )}
      </nav>

      <div
        className={
          styles.content
        }
        onContextMenu={
          abrirMenuVacio
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

            <p>
              Estamos consultando la organización del proyecto.
            </p>
          </div>
        ) : error ? (
          <div
            className={
              styles.state
            }
            role="alert"
          >
            <strong>
              No pudimos cargar las carpetas
            </strong>

            <p>
              {error}
            </p>
          </div>
        ) : carpetas.length ===
          0 &&
          fotografias.length ===
          0 &&
          panoramicas.length ===
          0 &&
          planos.length ===
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
              {carpetaActual
                ? 'Esta carpeta está vacía'
                : 'Todavía no hay carpetas'}
            </strong>

            <p>
              {carpetaActual
                ? 'Crea una subcarpeta o agrega recursos para comenzar a organizar este espacio.'
                : 'Crea una carpeta para comenzar a organizar los recursos del proyecto.'}
            </p>
          </div>
        ) : (
          <div
            className={
              styles.grid
            }


          >

            {carpetas.map(
              (
                carpeta,
              ) => (
                <article
                  className={
                    styles.folderCard
                  }
                  key={
                    carpeta.id_carpeta
                  }
                  data-folder-card="true"
                  onDoubleClick={() => {
                    void abrirCarpeta(
                      carpeta,
                    );
                  }}
                  onContextMenu={(
                    event,
                  ) => {
                    abrirMenuCarpeta(
                      event,
                      carpeta,
                    );
                  }}
                  title={`Abrir ${carpeta.nombre}`}
                >
                  <div
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
                  </div>

                  <div
                    className={
                      styles.folderInfo
                    }
                  >
                    <strong
                      title={
                        carpeta.nombre
                      }
                    >
                      {
                        carpeta.nombre
                      }
                    </strong>

                    <span>
                      Carpeta
                    </span>
                  </div>
                </article>
              ),
            )}

            {fotografias.map(
              (
                fotografia,
              ) => (
                <article
                  className={
                    styles.resourceCard
                  }
                  key={
                    fotografia.id_fotografia
                  }
                  title={
                    fotografia.titulo
                  }
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onAbrirFotografia(
                      fotografia,
                    );
                  }}
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      event.preventDefault();

                      onAbrirFotografia(
                        fotografia,
                      );
                    }
                  }}

                  onContextMenu={(
                    event,
                  ) => {
                    event.preventDefault();
                    event.stopPropagation();

                    setMenuVacio(
                      null,
                    );

                    setMenuCarpeta(
                      null,
                    );

                    setMenuRecurso({
                      x: event.clientX,
                      y: event.clientY,
                      recurso: {
                        tipo: 'FOTOGRAFIA',
                        recurso: fotografia,
                      },
                    });
                  }}
                >
                  <div
                    className={
                      styles.resourcePreview
                    }
                  >
                    <img
                      src={
                        fotografia.url
                      }
                      alt={
                        fotografia.titulo
                      }
                      loading="lazy"
                    />
                  </div>

                  <div
                    className={
                      styles.resourceBody
                    }
                  >
                    <div
                      className={
                        styles.resourceInfo
                      }
                    >
                      <strong
                        title={
                          fotografia.titulo
                        }
                      >
                        {
                          fotografia.titulo
                        }
                      </strong>

                      <span>
                        Fotografía
                      </span>
                    </div>

                  </div>
                </article>

              ),
            )}

            {panoramicas.map(
              (panoramica) => (
                <article
                  className={styles.resourceCard}
                  key={panoramica.id_panoramica}
                  title={panoramica.titulo}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onAbrirPanoramica(panoramica);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onAbrirPanoramica(panoramica);
                    }
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    setMenuVacio(null);
                    setMenuCarpeta(null);

                    setMenuRecurso({
                      x: event.clientX,
                      y: event.clientY,
                      recurso: {
                        tipo: 'PANORAMICA',
                        recurso: panoramica,
                      },
                    });
                  }}
                >
                  <div className={styles.resourcePreview}>
                    <img
                      src={panoramica.url}
                      alt={panoramica.titulo}
                      loading="lazy"
                    />
                    <span className={styles.panoramaBadge}>360°</span>
                  </div>

                  <div className={styles.resourceBody}>
                    <div className={styles.resourceInfo}>
                      <strong title={panoramica.titulo}>
                        {panoramica.titulo}
                      </strong>
                      <span>Panorámica</span>
                    </div>
                  </div>
                </article>
              ),
            )}

            {planos.map(
              (plano) => (
                <article
                  className={styles.resourceCard}
                  key={plano.id_plano}
                  title={plano.titulo}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onAbrirPlano(plano);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onAbrirPlano(plano);
                    }
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    setMenuVacio(null);
                    setMenuCarpeta(null);

                    setMenuRecurso({
                      x: event.clientX,
                      y: event.clientY,
                      recurso: {
                        tipo: 'PLANO',
                        recurso: plano,
                      },
                    });
                  }}
                >
                  <div className={styles.pdfPreview} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M6 2.75h7.25L18 7.5v13.75H6V2.75Zm7 1.5v3.5h3.5L13 4.25Z" />
                      <path d="M8.5 12h7M8.5 15h7" />
                    </svg>
                  </div>

                  <div className={styles.resourceBody}>
                    <div className={styles.resourceInfo}>
                      <strong title={plano.titulo}>
                        {plano.titulo}
                      </strong>
                      <span>Plano PDF</span>
                    </div>
                  </div>
                </article>
              ),
            )}

          </div>
        )}
      </div>

      {menuVacio && (
        <FolderContextMenu
          x={
            menuVacio.x
          }
          y={
            menuVacio.y
          }
          mode="EMPTY"
          onCerrar={() => {
            setMenuVacio(
              null,
            );
          }}
          onNuevaCarpeta={() => {
            abrirModalNuevaCarpeta();
          }}
          onAgregarRecursos={
            carpetaActual
              ? () => {
                setAgregandoRecursos(
                  true,
                );
              }
              : undefined
          }
        />
      )}

      {menuCarpeta && (
        <FolderContextMenu
          x={
            menuCarpeta.x
          }
          y={
            menuCarpeta.y
          }
          mode="FOLDER"
          onCerrar={() => {
            setMenuCarpeta(
              null,
            );
          }}
          onNuevaCarpeta={() => {
            abrirModalNuevaCarpeta();
          }}
          onAbrir={() => {
            void abrirCarpeta(
              menuCarpeta.carpeta,
            );
          }}
          onNuevaSubcarpeta={() => {
            abrirModalNuevaCarpeta(
              menuCarpeta.carpeta
                .id_carpeta,
            );
          }}

          onRenombrar={() => {
            setCarpetaRenombrando(
              menuCarpeta.carpeta,
            );
          }}

          onMover={() => {
            setCarpetaMoviendo(
              menuCarpeta.carpeta,
            );
          }}

          onEliminar={() => {
            setCarpetaEliminando(
              menuCarpeta.carpeta,
            );
          }}
        />
      )}

      {menuRecurso && (
        <ResourceContextMenu
          x={
            menuRecurso.x
          }
          y={
            menuRecurso.y
          }
          onCerrar={() => {
            setMenuRecurso(
              null,
            );
          }}
          onAbrir={() => {
            const seleccionado =
              menuRecurso.recurso;

            if (
              seleccionado.tipo ===
              'FOTOGRAFIA'
            ) {
              onAbrirFotografia(
                seleccionado.recurso,
              );

              return;
            }

            if (
              seleccionado.tipo ===
              'PANORAMICA'
            ) {
              onAbrirPanoramica(
                seleccionado.recurso,
              );

              return;
            }

            onAbrirPlano(
              seleccionado.recurso,
            );
          }}
          onMover={() => {
            setErrorMoverRecurso(
              null,
            );

            setRecursoAMover(
              menuRecurso.recurso,
            );
          }}
          onQuitar={() => {
            setErrorQuitarRecurso(
              null,
            );

            setRecursoAQuitar(
              menuRecurso.recurso,
            );
          }}
        />
      )}

      {creandoCarpeta && (
        <CreateFolderModal
          idProyecto={
            idProyecto
          }
          idCarpetaPadre={
            idPadreNuevaCarpeta
          }
          onCerrar={() => {
            setCreandoCarpeta(
              false,
            );
          }}
          onCreada={(
            carpeta,
          ) => {
            const perteneceUbicacionActual =
              carpeta.id_carpeta_padre ===
              (
                carpetaActual
                  ?.id_carpeta ??
                null
              );

            if (
              perteneceUbicacionActual
            ) {
              setCarpetas(
                (
                  actuales,
                ) => [
                    ...actuales,
                    carpeta,
                  ],
              );
            }

            setError(
              null,
            );

            setCreandoCarpeta(
              false,
            );
          }}
        />
      )}

      {carpetaRenombrando && (
        <RenameFolderModal
          idProyecto={
            idProyecto
          }
          carpeta={
            carpetaRenombrando
          }
          onCerrar={() => {
            setCarpetaRenombrando(
              null,
            );
          }}
          onRenombrada={(
            carpetaActualizada,
          ) => {
            setCarpetas(
              (
                actuales,
              ) =>
                actuales.map(
                  (
                    carpeta,
                  ) =>
                    carpeta.id_carpeta ===
                      carpetaActualizada.id_carpeta
                      ? carpetaActualizada
                      : carpeta,
                ),
            );

            setRutaCarpetas(
              (
                rutaActual,
              ) =>
                rutaActual.map(
                  (
                    carpeta,
                  ) =>
                    carpeta.id_carpeta ===
                      carpetaActualizada.id_carpeta
                      ? carpetaActualizada
                      : carpeta,
                ),
            );

            setError(
              null,
            );

            setCarpetaRenombrando(
              null,
            );
          }}
        />
      )}

      {carpetaMoviendo && (
        <MoveFolderModal
          idProyecto={
            idProyecto
          }
          carpeta={
            carpetaMoviendo
          }
          onCerrar={() => {
            setCarpetaMoviendo(
              null,
            );
          }}
          onMovida={(
            carpetaMovida,
          ) => {
            setCarpetas(
              (
                actuales,
              ) =>
                actuales.filter(
                  (
                    carpeta,
                  ) =>
                    carpeta.id_carpeta !==
                    carpetaMovida.id_carpeta,
                ),
            );

            setError(
              null,
            );

            setCarpetaMoviendo(
              null,
            );
          }}
        />
      )}

      {carpetaEliminando && (
        <DeleteFolderModal
          idProyecto={
            idProyecto
          }
          carpeta={
            carpetaEliminando
          }
          onCerrar={() => {
            setCarpetaEliminando(
              null,
            );
          }}
          onEliminada={(
            carpetaEliminada,
          ) => {
            setCarpetas(
              (
                actuales,
              ) =>
                actuales.filter(
                  (
                    carpeta,
                  ) =>
                    carpeta.id_carpeta !==
                    carpetaEliminada.id_carpeta,
                ),
            );

            setError(
              null,
            );

            setCarpetaEliminando(
              null,
            );
          }}
        />
      )}

      {agregandoRecursos &&
        carpetaActual && (
          <AddFolderResourcesModal
            idProyecto={
              idProyecto
            }
            idCarpeta={
              carpetaActual.id_carpeta
            }
            nombreCarpeta={
              carpetaActual.nombre
            }
            onCerrar={() => {
              setAgregandoRecursos(
                false,
              );
            }}
            onAgregados={() => {
              setAgregandoRecursos(
                false,
              );

              void abrirCarpeta(
                carpetaActual,
              );
            }}
          />
        )}

      {recursoAQuitar && (
        <RemoveFolderResourceModal
          nombreRecurso={
            recursoAQuitar.recurso.titulo
          }
          quitando={
            quitandoRecurso
          }
          error={
            errorQuitarRecurso
          }
          onCerrar={() => {
            if (
              quitandoRecurso
            ) {
              return;
            }

            setRecursoAQuitar(
              null,
            );

            setErrorQuitarRecurso(
              null,
            );
          }}
          onConfirmar={() => {
            void quitarRecurso(
              recursoAQuitar,
            );
          }}
        />
      )}

      {recursoAMover && carpetaActual && (
        <MoveFolderResourceModal
          idProyecto={
            idProyecto
          }
          idCarpetaActual={
            carpetaActual.id_carpeta
          }
          nombreRecurso={
            recursoAMover.recurso.titulo
          }
          moviendo={
            moviendoRecurso
          }
          error={
            errorMoverRecurso
          }
          onCerrar={() => {
            if (
              moviendoRecurso
            ) {
              return;
            }

            setRecursoAMover(
              null,
            );

            setErrorMoverRecurso(
              null,
            );
          }}
          onMover={(
            carpetaDestino,
          ) => {
            void moverRecurso(
              recursoAMover,
              carpetaDestino.id_carpeta,
            );
          }}
        />
      )}
    </section>
  );
}