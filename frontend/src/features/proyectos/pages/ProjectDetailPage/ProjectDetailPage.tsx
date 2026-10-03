import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  obtenerProyecto,
} from '../../api/proyectos.api';

import {
  eliminarFotografiaProyecto,
  establecerPortadaProyecto,
  listarFotografiasProyecto,
} from '../../api/fotografias.api';

import {
  eliminarPanoramicaProyecto,
  listarPanoramicasProyecto,
} from '../../api/panoramicas.api';

import {
  listarPlanosProyecto,
} from '../../api/planos.api';

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
  UploadPlanModal,
} from '../../components/UploadPlanModal/UploadPlanModal';

import {
  PanoramaViewer,
} from '../../components/PanoramaViewer/PanoramaViewer';

import {
  PhotoViewer,
} from '../../components/PhotoViewer/PhotoViewer';

import {
  PlanViewer,
} from '../../components/PlanViewer/PlanViewer';

import {
  EditPlanModal,
} from '../../components/EditPlanModal/EditPlanModal';

import {
  EditProjectModal,
} from '../../components/EditProjectModal/EditProjectModal';

import {
  DeletePlanModal,
} from '../../components/DeletePlanModal/DeletePlanModal';

import {
  ProjectsMap,
} from '../../components/ProjectsMap/ProjectsMap';

import {
  ProjectFolders,
} from '../../components/ProjectFolders/ProjectFolders';

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
  Proyecto,
} from '../../types/proyecto';

import type {
  NavegacionProyecto,
} from '../../types/navegacion-proyecto';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './ProjectDetailPage.module.css';

interface ProjectDetailPageProps {
  idProyecto: string;

  idUsuarioActual: string;

  navegacionInicial?: NavegacionProyecto | null;

  onVolver: () => void;
}

type SeccionProyecto =
  | 'resumen'
  | 'fotografias'
  | 'planos'
  | '360'
  | 'mapa'
  | 'carpetas';

type ContenidoEliminando =
  | {
    tipo: 'fotografia';

    fotografia:
    FotografiaProyecto;
  }
  | {
    tipo: 'panoramica';

    panoramica:
    PanoramicaProyecto;
  };

interface ConfirmDeleteMediaModalProps {
  titulo: string;

  nombre: string;

  eliminando: boolean;

  onCerrar: () => void;

  onConfirmar: () => void;
}

function ConfirmDeleteMediaModal({
  titulo,
  nombre,
  eliminando,
  onCerrar,
  onConfirmar,
}: ConfirmDeleteMediaModalProps) {
  useEffect(() => {
    function manejarEscape(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape' &&
        !eliminando
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
    eliminando,
    onCerrar,
  ]);

  return (
    <div
      className={
        styles.confirmOverlay
      }
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget &&
          !eliminando
        ) {
          onCerrar();
        }
      }}
    >
      <section
        className={
          styles.confirmDialog
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-media-title"
      >
        <div
          className={
            styles.confirmIcon
          }
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
          >
            <path
              d="M4 7h16"
            />

            <path
              d="M9 7V4h6v3"
            />

            <path
              d="m7 7 1 13h8l1-13"
            />

            <path
              d="M10 11v5"
            />

            <path
              d="M14 11v5"
            />
          </svg>
        </div>

        <div
          className={
            styles.confirmContent
          }
        >
          <h2
            id="confirm-delete-media-title"
          >
            {titulo}
          </h2>

          <p>
            Se eliminará{' '}
            <strong>
              {nombre}
            </strong>
            . Esta acción no se puede deshacer.
          </p>
        </div>

        <div
          className={
            styles.confirmActions
          }
        >
          <button
            type="button"
            className={
              styles.confirmCancelButton
            }
            disabled={
              eliminando
            }
            onClick={
              onCerrar
            }
          >
            Cancelar
          </button>

          <button
            type="button"
            className={
              styles.confirmDeleteButton
            }
            disabled={
              eliminando
            }
            onClick={
              onConfirmar
            }
          >
            {eliminando
              ? 'Eliminando...'
              : 'Eliminar'}
          </button>
        </div>
      </section>
    </div>
  );
}

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

function formatearFechaHora(
  fecha:
    string,
): string {
  const valor =
    new Date(
      fecha,
    );

  if (
    Number.isNaN(
      valor.getTime(),
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
    valor,
  );
}

export function ProjectDetailPage({
  idProyecto,
  idUsuarioActual,
  navegacionInicial = null,
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
  >(
    [],
  );

  const [
    panoramicas,
    setPanoramicas,
  ] = useState<
    PanoramicaProyecto[]
  >(
    [],
  );

  const [
    planos,
    setPlanos,
  ] = useState<
    PlanoProyecto[]
  >(
    [],
  );

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
    cargandoPlanos,
    setCargandoPlanos,
  ] = useState(
    true,
  );

  const [
    cambiandoPortada,
    setCambiandoPortada,
  ] = useState<
    string | null
  >(
    null,
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
    errorFotografias,
    setErrorFotografias,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    errorPanoramicas,
    setErrorPanoramicas,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    errorPlanos,
    setErrorPlanos,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    editandoProyecto,
    setEditandoProyecto,
  ] = useState(
    false,
  );

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
  >(
    null,
  );

  const [
    archivoPanoramica,
    setArchivoPanoramica,
  ] = useState<
    File | null
  >(
    null,
  );

  const [
    archivoPlano,
    setArchivoPlano,
  ] = useState<
    File | null
  >(
    null,
  );

  const [
    fotografiaAbierta,
    setFotografiaAbierta,
  ] = useState<
    FotografiaProyecto | null
  >(
    null,
  );

  const [
    panoramicaAbierta,
    setPanoramicaAbierta,
  ] = useState<
    PanoramicaProyecto | null
  >(
    null,
  );

  const [
    planoAbierto,
    setPlanoAbierto,
  ] = useState<
    PlanoProyecto | null
  >(
    null,
  );

  const [
    planoEditando,
    setPlanoEditando,
  ] = useState<
    PlanoProyecto | null
  >(
    null,
  );

  const [
    planoEliminando,
    setPlanoEliminando,
  ] = useState<
    PlanoProyecto | null
  >(
    null,
  );

  const [
    menuPlanoAbierto,
    setMenuPlanoAbierto,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    menuFotografiaAbierto,
    setMenuFotografiaAbierto,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    menuPanoramicaAbierto,
    setMenuPanoramicaAbierto,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    contenidoEliminando,
    setContenidoEliminando,
  ] = useState<
    ContenidoEliminando | null
  >(
    null,
  );

  const [
    eliminandoContenido,
    setEliminandoContenido,
  ] = useState(
    false,
  );

  const [
    seccionActiva,
    setSeccionActiva,
  ] =
    useState<
      SeccionProyecto
    >(
      'resumen',
    );

  const [
    versionCarpetas,
    setVersionCarpetas,
  ] = useState(
    0,
  );

  const navegacionAplicadaRef =
    useRef<
      string | null
    >(
      null,
    );

  const recursoAbiertoRef =
    useRef<
      string | null
    >(
      null,
    );

  const inputFotografiaRef =
    useRef<
      HTMLInputElement | null
    >(
      null,
    );

  const inputPanoramicaRef =
    useRef<
      HTMLInputElement | null
    >(
      null,
    );

  const inputPlanoRef =
    useRef<
      HTMLInputElement | null
    >(
      null,
    );

  useEffect(() => {
    function cerrarMenusFuera(
      event:
        PointerEvent,
    ) {
      const elemento =
        event.target;

      if (
        !(elemento instanceof Element)
      ) {
        return;
      }

      if (
        elemento.closest(
          `.${styles.planActions}`,
        )
      ) {
        return;
      }

      setMenuFotografiaAbierto(
        null,
      );

      setMenuPlanoAbierto(
        null,
      );

      setMenuPanoramicaAbierto(
        null,
      );
    }

    document.addEventListener(
      'pointerdown',
      cerrarMenusFuera,
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        cerrarMenusFuera,
      );
    };
  }, []);

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

  useEffect(() => {
    let activa =
      true;

    async function cargarPlanos() {
      setCargandoPlanos(
        true,
      );

      setErrorPlanos(
        null,
      );

      try {
        const respuesta =
          await listarPlanosProyecto(
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

        setPlanos(
          respuesta.planos,
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
          setErrorPlanos(
            errorObtenido.message,
          );
        } else {
          setErrorPlanos(
            'No fue posible cargar los planos del proyecto.',
          );
        }
      } finally {
        if (
          activa
        ) {
          setCargandoPlanos(
            false,
          );
        }
      }
    }

    void cargarPlanos();

    return () => {
      activa =
        false;
    };
  }, [
    idProyecto,
  ]);

  /*
   * ====================================================
   * NAVEGACIÓN DESDE NOTIFICACIONES
   * ====================================================
   */

  useEffect(() => {
    if (
      !navegacionInicial ||
      navegacionAplicadaRef.current ===
      navegacionInicial.clave
    ) {
      return;
    }

    navegacionAplicadaRef.current =
      navegacionInicial.clave;

    setMostrandoColaboradores(
      false,
    );

    setFotografiaAbierta(
      null,
    );

    setPlanoAbierto(
      null,
    );

    setPanoramicaAbierta(
      null,
    );

    switch (
    navegacionInicial.destino
    ) {
      case 'FOTOGRAFIAS':
        setSeccionActiva(
          'fotografias',
        );
        break;

      case 'PLANOS':
        setSeccionActiva(
          'planos',
        );
        break;



      case 'PANORAMICAS':
        setSeccionActiva(
          '360',
        );
        break;

      case 'MAPA':
      case 'CAPAS':
        setSeccionActiva(
          'mapa',
        );
        break;

      case 'CARPETAS':
        setSeccionActiva(
          'carpetas',
        );
        break;

      case 'COLABORADORES':
        setSeccionActiva(
          'resumen',
        );

        setMostrandoColaboradores(
          true,
        );
        break;

      case 'RESUMEN':
      default:
        setSeccionActiva(
          'resumen',
        );
        break;
    }
  }, [
    navegacionInicial,
  ]);

  useEffect(() => {
    if (
      !navegacionInicial ||
      !navegacionInicial.idRecurso ||
      recursoAbiertoRef.current ===
      navegacionInicial.clave
    ) {
      return;
    }

    if (
      navegacionInicial.destino ===
      'PLANOS'
    ) {
      const plano =
        planos.find(
          (
            item,
          ) =>
            item.id_plano ===
            navegacionInicial.idRecurso,
        );

      if (
        !plano
      ) {
        return;
      }

      recursoAbiertoRef.current =
        navegacionInicial.clave;

      setPlanoAbierto(
        plano,
      );

      return;
    }

    if (
      navegacionInicial.destino ===
      'PANORAMICAS'
    ) {
      const panoramica =
        panoramicas.find(
          (
            item,
          ) =>
            item.id_panoramica ===
            navegacionInicial.idRecurso,
        );

      if (
        !panoramica
      ) {
        return;
      }

      recursoAbiertoRef.current =
        navegacionInicial.clave;

      setPanoramicaAbierta(
        panoramica,
      );

      return;
    }

    if (
      navegacionInicial.destino ===
      'FOTOGRAFIAS'
    ) {
      const fotografia =
        fotografias.find(
          (
            item,
          ) =>
            item.id_fotografia ===
            navegacionInicial.idRecurso,
        );

      if (
        !fotografia
      ) {
        return;
      }

      recursoAbiertoRef.current =
        navegacionInicial.clave;

      setFotografiaAbierta(
        fotografia,
      );
    }
  }, [
    navegacionInicial,
    fotografias,
    panoramicas,
    planos,
  ]);

  useEffect(() => {
    let activo =
      true;

    const eventos =
      new EventSource(
        '/api/notificaciones/eventos',
      );

    async function actualizarFotografias() {
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
          !activo
        ) {
          return;
        }

        setFotografias(
          respuesta.fotografias,
        );

        setErrorFotografias(
          null,
        );
      } catch {
        /*
         * No mostramos un error nuevo por una actualización
         * silenciosa en tiempo real.
         *
         * La información actual permanece visible.
         */
      }
    }

    async function actualizarPanoramicas() {
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
          !activo
        ) {
          return;
        }

        setPanoramicas(
          respuesta.panoramicas,
        );

        setErrorPanoramicas(
          null,
        );
      } catch {
        // Conservamos el contenido actual.
      }
    }

    async function actualizarPlanos() {
      try {
        const respuesta =
          await listarPlanosProyecto(
            idProyecto,
            {
              pagina:
                1,

              limite:
                50,
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

        setErrorPlanos(
          null,
        );
      } catch {
        // Conservamos el contenido actual.
      }
    }

    function manejarCambioProyecto(
      event: Event,
    ) {
      if (
        !(event instanceof MessageEvent)
      ) {
        return;
      }

      let datos: {
        id_proyecto?: unknown;
        recurso?: unknown;
      };

      try {
        datos =
          JSON.parse(
            event.data,
          ) as {
            id_proyecto?: unknown;
            recurso?: unknown;
          };
      } catch {
        return;
      }

      if (
        datos.id_proyecto !==
        idProyecto
      ) {
        return;
      }

      switch (
      datos.recurso
      ) {
        case 'FOTOGRAFIAS':
          void actualizarFotografias();
          break;

        case 'PANORAMICAS':
          void actualizarPanoramicas();
          break;

        case 'PLANOS':
          void actualizarPlanos();
          break;

        case 'PLANOS':
          void actualizarPlanos();
          break;

        case 'CARPETAS':
          setVersionCarpetas((
            versionActual,
          ) =>
            versionActual + 1,
          );
          break;

        default:
          break;

        //default:
        //break;
      }
    }

    eventos.addEventListener(
      'proyecto',
      manejarCambioProyecto,
    );

    eventos.onerror =
      () => {
        /*
         * EventSource intenta reconectarse
         * automáticamente.
         */
      };

    return () => {
      activo =
        false;

      eventos.removeEventListener(
        'proyecto',
        manejarCambioProyecto,
      );

      eventos.close();
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

  function seleccionarArchivoPlano(
    archivo:
      File,
  ) {
    setErrorPlanos(
      null,
    );

    setArchivoPlano(
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
          ...actuales.filter(
            (
              fotografia,
            ) =>
              fotografia.id_fotografia !==
              nuevaFotografia.id_fotografia,
          ),
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
          ...actuales.filter(
            (
              panoramica,
            ) =>
              panoramica.id_panoramica !==
              nuevaPanoramica.id_panoramica,
          ),
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

  function planoSubido(
    nuevoPlano:
      PlanoProyecto,
  ) {
    setPlanos(
      (
        actuales,
      ) => [
          nuevoPlano,
          ...actuales.filter(
            (
              plano,
            ) =>
              plano.id_plano !==
              nuevoPlano.id_plano,
          ),
        ],
    );

    setArchivoPlano(
      null,
    );

    setErrorPlanos(
      null,
    );

    setSeccionActiva(
      'planos',
    );
  }
  function planoActualizado(
    planoActualizado:
      PlanoProyecto,
  ) {
    setPlanos(
      (
        actuales,
      ) =>
        actuales.map(
          (
            plano,
          ) =>
            plano.id_plano ===
              planoActualizado.id_plano
              ? planoActualizado
              : plano,
        ),
    );

    setPlanoEditando(
      null,
    );

    setMenuPlanoAbierto(
      null,
    );

    setErrorPlanos(
      null,
    );

    if (
      planoAbierto?.id_plano ===
      planoActualizado.id_plano
    ) {
      setPlanoAbierto(
        planoActualizado,
      );
    }
  }

  function planoEliminado(
    idPlano:
      string,
  ) {
    setPlanos(
      (
        actuales,
      ) =>
        actuales.filter(
          (
            plano,
          ) =>
            plano.id_plano !==
            idPlano,
        ),
    );

    setPlanoEliminando(
      null,
    );

    setMenuPlanoAbierto(
      null,
    );

    setErrorPlanos(
      null,
    );

    if (
      planoAbierto?.id_plano ===
      idPlano
    ) {
      setPlanoAbierto(
        null,
      );
    }
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

  function cerrarModalPlano() {
    setArchivoPlano(
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

  function solicitarEliminarFotografia(
    fotografia:
      FotografiaProyecto,
  ) {
    setMenuFotografiaAbierto(
      null,
    );

    setContenidoEliminando({
      tipo:
        'fotografia',

      fotografia,
    });

    setErrorFotografias(
      null,
    );
  }

  function solicitarEliminarPanoramica(
    panoramica:
      PanoramicaProyecto,
  ) {
    setMenuPanoramicaAbierto(
      null,
    );

    setContenidoEliminando({
      tipo:
        'panoramica',

      panoramica,
    });

    setErrorPanoramicas(
      null,
    );
  }
  async function confirmarEliminacionContenido() {
    if (
      !contenidoEliminando ||
      eliminandoContenido
    ) {
      return;
    }

    setEliminandoContenido(
      true,
    );

    if (
      contenidoEliminando.tipo ===
      'fotografia'
    ) {
      setErrorFotografias(
        null,
      );

      try {
        const idFotografia =
          contenidoEliminando
            .fotografia
            .id_fotografia;

        await eliminarFotografiaProyecto(
          idProyecto,
          idFotografia,
        );

        setFotografias(
          (
            actuales,
          ) =>
            actuales.filter(
              (
                fotografia,
              ) =>
                fotografia.id_fotografia !==
                idFotografia,
            ),
        );

        if (
          fotografiaAbierta
            ?.id_fotografia ===
          idFotografia
        ) {
          setFotografiaAbierta(
            null,
          );
        }

        setContenidoEliminando(
          null,
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
            'No fue posible eliminar la fotografía.',
          );
        }

        setContenidoEliminando(
          null,
        );
      } finally {
        setEliminandoContenido(
          false,
        );
      }

      return;
    }

    setErrorPanoramicas(
      null,
    );

    try {
      const idPanoramica =
        contenidoEliminando
          .panoramica
          .id_panoramica;

      await eliminarPanoramicaProyecto(
        idProyecto,
        idPanoramica,
      );

      setPanoramicas(
        (
          actuales,
        ) =>
          actuales.filter(
            (
              panoramica,
            ) =>
              panoramica.id_panoramica !==
              idPanoramica,
          ),
      );

      if (
        panoramicaAbierta
          ?.id_panoramica ===
        idPanoramica
      ) {
        setPanoramicaAbierta(
          null,
        );
      }

      setContenidoEliminando(
        null,
      );
    } catch (
    errorObtenido
    ) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setErrorPanoramicas(
          errorObtenido.message,
        );
      } else {
        setErrorPanoramicas(
          'No fue posible eliminar la panorámica 360°.',
        );
      }

      setContenidoEliminando(
        null,
      );
    } finally {
      setEliminandoContenido(
        false,
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
    ) ??
    null;

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
                className={`${styles.statusBadge} ${proyecto.estado_proyecto ===
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
                  <path d="M12 16V4" />

                  <path d="m7 9 5-5 5 5" />

                  <path d="M5 20h14" />
                </svg>

                <span>
                  Subir contenido
                </span>

                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m7 10 5 5 5-5" />
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
                    onClick={() => {
                      setMostrandoMenuSubida(
                        false,
                      );

                      inputPlanoRef.current?.click();
                    }}
                  >
                    <span>
                      Plano
                    </span>

                    <small>
                      Documento PDF
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
                  inputPlanoRef
                }
                className={
                  styles.hiddenInput
                }
                type="file"
                accept="application/pdf,.pdf"
                onChange={(
                  event,
                ) => {
                  const archivo =
                    event.target.files?.[0];

                  if (
                    archivo
                  ) {
                    seleccionarArchivoPlano(
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
                  onClick={() => {
                    setEditandoProyecto(
                      true,
                    );
                  }}
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

                  setMenuFotografiaAbierto(
                    null,
                  );

                  setMenuPanoramicaAbierto(
                    null,
                  );

                  setMenuPlanoAbierto(
                    null,
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

        {errorPlanos && (
          <div
            className={
              styles.inlineError
            }
            role="alert"
          >
            {
              errorPlanos
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
                          <button
                            type="button"
                            onClick={() => {
                              setFotografiaAbierta(
                                fotografia,
                              );
                            }}
                            aria-label={`Abrir fotografía ${fotografia.titulo}`}
                          >
                            <img
                              src={
                                fotografia.url
                              }
                              alt={
                                fotografia.titulo
                              }
                            />
                          </button>

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
                        id={`fotografia-${fotografia.id_fotografia}`}
                        key={
                          fotografia.id_fotografia
                        }
                        className={
                          styles.galleryCard
                        }
                      >
                        <div
                          className={
                            styles.planActions
                          }
                        >
                          <button
                            className={
                              styles.planMenuButton
                            }
                            type="button"
                            aria-label={`Opciones de ${fotografia.titulo}`}
                            aria-expanded={
                              menuFotografiaAbierto ===
                              fotografia.id_fotografia
                            }
                            onClick={() => {
                              setMenuPanoramicaAbierto(
                                null,
                              );

                              setMenuPlanoAbierto(
                                null,
                              );

                              setMenuFotografiaAbierto(
                                (
                                  actual,
                                ) =>
                                  actual ===
                                    fotografia.id_fotografia
                                    ? null
                                    : fotografia.id_fotografia,
                              );
                            }}
                          >
                            ⋮
                          </button>

                          {menuFotografiaAbierto ===
                            fotografia.id_fotografia && (
                              <div
                                className={
                                  styles.planMenu
                                }
                              >
                                {esPropietario &&
                                  !fotografia.es_portada && (
                                    <button
                                      type="button"
                                      disabled={
                                        cambiandoPortada !==
                                        null
                                      }
                                      onClick={() => {
                                        setMenuFotografiaAbierto(
                                          null,
                                        );

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

                                <button
                                  className={
                                    styles.planMenuDanger
                                  }
                                  type="button"
                                  onClick={() => {
                                    solicitarEliminarFotografia(
                                      fotografia,
                                    );
                                  }}
                                >
                                  Eliminar fotografía
                                </button>
                              </div>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFotografiaAbierta(
                              fotografia,
                            );
                          }}
                          style={{
                            display:
                              'block',

                            width:
                              '100%',

                            padding:
                              0,

                            border:
                              0,

                            background:
                              'transparent',

                            cursor:
                              'zoom-in',
                          }}
                          aria-label={`Abrir fotografía ${fotografia.titulo}`}
                        >
                          <img
                            src={
                              fotografia.url
                            }
                            alt={
                              fotografia.titulo
                            }
                          />
                        </button>

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
                    Planos
                  </h2>

                  <p>
                    Documentos PDF asociados al proyecto.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    inputPlanoRef.current?.click();
                  }}
                >
                  Subir plano
                </button>
              </div>

              {cargandoPlanos ? (
                <div
                  className={
                    styles.emptySection
                  }
                >
                  Cargando planos...
                </div>
              ) : planos.length ===
                0 ? (
                <div
                  className={
                    styles.emptySection
                  }
                >
                  Todavía no hay planos PDF en este proyecto.
                </div>
              ) : (
                <div
                  className={
                    styles.galleryGrid
                  }
                >
                  {planos.map(
                    (
                      plano,
                    ) => (
                      <article
                        key={
                          plano.id_plano
                        }
                        className={`${styles.galleryCard} ${styles.planCard}`}
                        role="button"
                        tabIndex={
                          0
                        }
                        aria-label={`Abrir plano ${plano.titulo}`}
                        onClick={() => {
                          setPlanoAbierto(
                            plano,
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

                            setPlanoAbierto(
                              plano,
                            );
                          }
                        }}
                      >
                        <div
                          className={
                            styles.planActions
                          }
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(
                            event,
                          ) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            className={
                              styles.planMenuButton
                            }
                            type="button"
                            aria-label={`Opciones de ${plano.titulo}`}
                            aria-expanded={
                              menuPlanoAbierto ===
                              plano.id_plano
                            }
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();

                              setMenuFotografiaAbierto(
                                null,
                              );

                              setMenuPanoramicaAbierto(
                                null,
                              );

                              setMenuPlanoAbierto(
                                (
                                  actual,
                                ) =>
                                  actual ===
                                    plano.id_plano
                                    ? null
                                    : plano.id_plano,
                              );
                            }}
                          >
                            ⋮
                          </button>

                          {menuPlanoAbierto ===
                            plano.id_plano && (
                              <div
                                className={
                                  styles.planMenu
                                }
                              >
                                <button
                                  type="button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    setMenuPlanoAbierto(
                                      null,
                                    );

                                    setPlanoAbierto(
                                      plano,
                                    );
                                  }}
                                >
                                  Abrir plano
                                </button>

                                <button
                                  type="button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    setMenuPlanoAbierto(
                                      null,
                                    );

                                    setPlanoEditando(
                                      plano,
                                    );
                                  }}
                                >
                                  Editar información
                                </button>

                                <button
                                  className={
                                    styles.planMenuDanger
                                  }
                                  type="button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    setMenuPlanoAbierto(
                                      null,
                                    );

                                    setPlanoEliminando(
                                      plano,
                                    );
                                  }}
                                >
                                  Eliminar plano
                                </button>
                              </div>
                            )}
                        </div>

                        <div
                          style={{
                            minHeight:
                              '180px',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            background:
                              '#f4f5f6',

                            color:
                              'var(--color-brand-orange)',
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            style={{
                              width:
                                '54px',

                              height:
                                '54px',

                              fill:
                                'none',

                              stroke:
                                'currentColor',

                              strokeWidth:
                                1.5,

                              strokeLinecap:
                                'round',

                              strokeLinejoin:
                                'round',
                            }}
                          >
                            <path d="M6 2h8l4 4v16H6Z" />

                            <path d="M14 2v5h5" />

                            <path d="M9 13h6" />

                            <path d="M9 17h6" />
                          </svg>
                        </div>

                        <div
                          className={
                            styles.galleryInfo
                          }
                        >
                          <div>
                            <strong>
                              {
                                plano.titulo
                              }
                            </strong>

                            <span
                              className={
                                styles.coverBadge
                              }
                            >
                              PDF
                            </span>
                          </div>

                          <small>
                            {formatearFechaHora(
                              plano.fecha_subida,
                            )}
                          </small>

                          {plano.descripcion && (
                            <p>
                              {
                                plano.descripcion
                              }
                            </p>
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
                        <div
                          className={
                            styles.planActions
                          }
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation();
                          }}
                          onKeyDown={(
                            event,
                          ) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            className={
                              styles.planMenuButton
                            }
                            type="button"
                            aria-label={`Opciones de ${panoramica.titulo}`}
                            aria-expanded={
                              menuPanoramicaAbierto ===
                              panoramica.id_panoramica
                            }
                            onClick={(
                              event,
                            ) => {
                              event.stopPropagation();

                              setMenuFotografiaAbierto(
                                null,
                              );

                              setMenuPlanoAbierto(
                                null,
                              );

                              setMenuPanoramicaAbierto(
                                (
                                  actual,
                                ) =>
                                  actual ===
                                    panoramica.id_panoramica
                                    ? null
                                    : panoramica.id_panoramica,
                              );
                            }}
                          >
                            ⋮
                          </button>

                          {menuPanoramicaAbierto ===
                            panoramica.id_panoramica && (
                              <div
                                className={
                                  styles.planMenu
                                }
                              >
                                <button
                                  type="button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    setMenuPanoramicaAbierto(
                                      null,
                                    );

                                    setPanoramicaAbierta(
                                      panoramica,
                                    );
                                  }}
                                >
                                  Abrir panorámica
                                </button>

                                <button
                                  className={
                                    styles.planMenuDanger
                                  }
                                  type="button"
                                  onClick={(
                                    event,
                                  ) => {
                                    event.stopPropagation();

                                    solicitarEliminarPanoramica(
                                      panoramica,
                                    );
                                  }}
                                >
                                  Eliminar panorámica
                                </button>
                              </div>
                            )}
                        </div>

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
                styles.mapSection
              }
            >
              <div
                className={
                  styles.mapHeader
                }
              >
                <div>
                  <h2>
                    Mapa
                  </h2>

                  <p>
                    Ortofotos, capas geográficas y ubicación del proyecto.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.projectMap
                }
              >
                <ProjectsMap
                  proyectos={[
                    proyecto,
                  ]}
                  proyectoSeleccionadoId={
                    proyecto.id_proyecto
                  }
                  mostrarMarcadores={
                    false
                  }
                  incidenciaInicialId={
                    navegacionInicial?.destino ===
                      'MAPA'
                      ? navegacionInicial.idRecurso
                      : null
                  }
                  abrirCapasInicialmente={
                    navegacionInicial?.destino ===
                    'CAPAS'
                  }
                  navegacionClave={
                    navegacionInicial?.clave ??
                    null
                  }
                />
              </div>
            </section>
          )}

        {seccionActiva === 'carpetas' && (
          <ProjectFolders
            idProyecto={
              idProyecto
            }
            versionCarpetas={
              versionCarpetas
            }
            onAbrirFotografia={(
              fotografia,
            ) => {
              setFotografiaAbierta(
                fotografia,
              );
            }}
            onAbrirPanoramica={(
              panoramica,
            ) => {
              setPanoramicaAbierta(
                panoramica,
              );
            }}
            onAbrirPlano={(
              plano,
            ) => {
              setPlanoAbierto(
                plano,
              );
            }}
          />
        )}
      </section>
      {editandoProyecto && (
        <EditProjectModal
          proyecto={
            proyecto
          }
          onCerrar={() => {
            setEditandoProyecto(
              false,
            );
          }}
          onActualizado={(
            proyectoActualizado,
          ) => {
            setProyecto(
              proyectoActualizado,
            );

            setEditandoProyecto(
              false,
            );
          }}
        />
      )}

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

      {archivoPlano && (
        <UploadPlanModal
          idProyecto={
            proyecto.id_proyecto
          }
          archivo={
            archivoPlano
          }
          onCerrar={
            cerrarModalPlano
          }
          onSubidaCompleta={
            planoSubido
          }
        />
      )}

      {fotografiaAbierta && (
        <PhotoViewer
          fotografia={
            fotografiaAbierta
          }
          onCerrar={() => {
            setFotografiaAbierta(
              null,
            );
          }}
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

      {planoAbierto && (
        <PlanViewer
          plano={
            planoAbierto
          }
          incidenciaInicialId={
            navegacionInicial?.destino ===
              'PLANOS'
              ? navegacionInicial.idIncidencia
              : null
          }
          onCerrar={() => {
            setPlanoAbierto(
              null,
            );
          }}
        />
      )}

      {planoEditando && (
        <EditPlanModal
          idProyecto={
            proyecto.id_proyecto
          }
          plano={
            planoEditando
          }
          onCerrar={() => {
            setPlanoEditando(
              null,
            );
          }}
          onActualizado={
            planoActualizado
          }
        />
      )}

      {planoEliminando && (
        <DeletePlanModal
          idProyecto={
            proyecto.id_proyecto
          }
          plano={
            planoEliminando
          }
          onCerrar={() => {
            setPlanoEliminando(
              null,
            );
          }}
          onEliminado={
            planoEliminado
          }
        />
      )}

      {contenidoEliminando && (
        <ConfirmDeleteMediaModal
          titulo={
            contenidoEliminando.tipo ===
              'fotografia'
              ? '¿Eliminar esta fotografía?'
              : '¿Eliminar esta panorámica?'
          }
          nombre={
            contenidoEliminando.tipo ===
              'fotografia'
              ? contenidoEliminando.fotografia.titulo
              : contenidoEliminando.panoramica.titulo
          }
          eliminando={
            eliminandoContenido
          }
          onCerrar={() => {
            if (
              !eliminandoContenido
            ) {
              setContenidoEliminando(
                null,
              );
            }
          }}
          onConfirmar={() => {
            void confirmarEliminacionContenido();
          }}
        />
      )}
    </>
  );
}