import {
  useEffect,
  useRef,
  useState,
} from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import {
  listarCapasProyecto,
  obtenerTileJsonCapa,
} from '../../api/capas.api';

import {
  listarFotografiasProyecto,
} from '../../api/fotografias.api';

import {
  listarPanoramicasProyecto,
} from '../../api/panoramicas.api';

import {
  actualizarIncidenciaMapa,
  crearIncidenciaMapa,
  eliminarIncidenciaMapa,
  listarIncidenciasMapa,
} from '../../api/incidencias.api';

import type {
  CapaProyecto,
  TileJsonCapa,
} from '../../types/capa';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import type {
  PanoramicaProyecto,
} from '../../types/panoramica';

import type {
  EstadoIncidencia,
  IncidenciaMapa,
  PrioridadIncidencia,
} from '../../types/incidencia';

import type {
  Proyecto,
} from '../../types/proyecto';

import {
  MapLayersPanel,
} from '../MapLayersPanel/MapLayersPanel';

import {
  UploadLayerModal,
} from '../UploadLayerModal/UploadLayerModal';

import {
  PanoramaViewer,
} from '../PanoramaViewer/PanoramaViewer';

import styles from './ProjectsMap.module.css';

interface ProjectsMapProps {
  proyectos: Proyecto[];

  proyectoSeleccionadoId?:
  string | null;

  mostrarMarcadores?:
  boolean;

  incidenciaInicialId?:
  string | null;

  abrirCapasInicialmente?:
  boolean;

  navegacionClave?:
  string | null;
}

interface MarcadorProyecto {
  idProyecto: string;

  marcador:
  mapboxgl.Marker;

  popup:
  mapboxgl.Popup;
}

type TipoNuevaIncidencia =
  | 'TEXTO'
  | 'FOTOGRAFIA'
  | 'PANORAMICA';

interface PuntoMapa {
  latitud: number;

  longitud: number;
}

const CENTRO_INICIAL: [
  number,
  number,
] = [
    -74.2973,
    4.5709,
  ];

function crearContenidoPopup(
  proyecto:
    Proyecto,
): HTMLElement {
  const contenedor =
    document.createElement(
      'div',
    );

  const nombre =
    document.createElement(
      'strong',
    );

  const direccion =
    document.createElement(
      'p',
    );

  nombre.textContent =
    proyecto.nombre;

  direccion.textContent =
    proyecto.direccion;

  contenedor.append(
    nombre,
    direccion,
  );

  return contenedor;
}

function obtenerSourceId(
  idCapa: string,
): string {
  return `ingevit-capa-source-${idCapa}`;
}

function obtenerLayerId(
  idCapa: string,
): string {
  return `ingevit-capa-layer-${idCapa}`;
}

function obtenerTipoIncidencia(
  incidencia:
    IncidenciaMapa,
): string {
  if (
    incidencia.id_fotografia
  ) {
    return 'Fotografía';
  }

  if (
    incidencia.id_panoramica
  ) {
    return 'Panorámica 360°';
  }

  return 'Texto';
}

function obtenerTextoEstado(
  estado:
    EstadoIncidencia,
): string {
  if (
    estado ===
    'EN_PROCESO'
  ) {
    return 'En proceso';
  }

  if (
    estado ===
    'SOLUCIONADA'
  ) {
    return 'Solucionada';
  }

  return 'Pendiente';
}

function obtenerTextoPrioridad(
  prioridad:
    PrioridadIncidencia,
): string {
  if (
    prioridad ===
    'ALTA'
  ) {
    return 'Alta';
  }

  if (
    prioridad ===
    'BAJA'
  ) {
    return 'Baja';
  }

  return 'Media';
}

export function ProjectsMap({
  proyectos,
  proyectoSeleccionadoId = null,
  mostrarMarcadores = true,
  incidenciaInicialId = null,
  abrirCapasInicialmente = false,
  navegacionClave = null,
}: ProjectsMapProps) {
  const mapContainer =
    useRef<
      HTMLDivElement | null
    >(
      null,
    );

  const map =
    useRef<
      mapboxgl.Map | null
    >(
      null,
    );

  const marcadores =
    useRef<
      MarcadorProyecto[]
    >(
      [],
    );

  const marcadoresIncidencias =
    useRef<
      mapboxgl.Marker[]
    >(
      [],
    );

  const marcadorNuevaIncidencia =
    useRef<
      mapboxgl.Marker | null
    >(
      null,
    );

  const marcadorEdicionIncidencia =
    useRef<
      mapboxgl.Marker | null
    >(
      null,
    );

  const tileJsonCache =
    useRef<
      Map<
        string,
        TileJsonCapa
      >
    >(
      new Map(),
    );

  const capaPendienteZoomRef =
    useRef<
      string | null
    >(
      null,
    );

  const enfoqueInicialRealizadoRef =
    useRef(
      false,
    );

  const navegacionExternaAplicadaRef =
    useRef<
      string | null
    >(
      null,
    );

  const [
    panelCapasAbierto,
    setPanelCapasAbierto,
  ] = useState(
    false,
  );

  const [
    modalSubirCapaAbierto,
    setModalSubirCapaAbierto,
  ] = useState(
    false,
  );

  const [
    panelIncidenciaAbierto,
    setPanelIncidenciaAbierto,
  ] = useState(
    false,
  );

  const [
    capasMapa,
    setCapasMapa,
  ] = useState<
    CapaProyecto[]
  >(
    [],
  );

  const [
    fotografiasMapa,
    setFotografiasMapa,
  ] = useState<
    FotografiaProyecto[]
  >(
    [],
  );

  const [
    panoramicasMapa,
    setPanoramicasMapa,
  ] = useState<
    PanoramicaProyecto[]
  >(
    [],
  );

  const [
    incidenciasMapa,
    setIncidenciasMapa,
  ] = useState<
    IncidenciaMapa[]
  >(
    [],
  );

  const [
    fotografiaAbierta,
    setFotografiaAbierta,
  ] = useState<
    FotografiaProyecto | null
  >(
    null,
  );

  const fotografiaDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = fotografiaDialogRef.current;

    if (!fotografiaAbierta || !dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [fotografiaAbierta]);

  const [
    panoramicaAbierta,
    setPanoramicaAbierta,
  ] = useState<
    PanoramicaProyecto | null
  >(
    null,
  );

  const [
    versionPanelCapas,
    setVersionPanelCapas,
  ] = useState(
    0,
  );

  /*
   * ====================================================
   * NUEVA INCIDENCIA
   * ====================================================
   */

  const [
    tipoNuevaIncidencia,
    setTipoNuevaIncidencia,
  ] = useState<
    TipoNuevaIncidencia
  >(
    'TEXTO',
  );

  const [
    puntoNuevaIncidencia,
    setPuntoNuevaIncidencia,
  ] = useState<
    PuntoMapa | null
  >(
    null,
  );

  const [
    fotografiaSeleccionadaId,
    setFotografiaSeleccionadaId,
  ] = useState(
    '',
  );

  const [
    panoramicaSeleccionadaId,
    setPanoramicaSeleccionadaId,
  ] = useState(
    '',
  );

  const [
    tituloIncidencia,
    setTituloIncidencia,
  ] = useState(
    '',
  );

  const [
    descripcionIncidencia,
    setDescripcionIncidencia,
  ] = useState(
    '',
  );

  const [
    prioridadIncidencia,
    setPrioridadIncidencia,
  ] = useState<
    PrioridadIncidencia
  >(
    'MEDIA',
  );

  const [
    guardandoIncidencia,
    setGuardandoIncidencia,
  ] = useState(
    false,
  );

  const [
    errorIncidencia,
    setErrorIncidencia,
  ] = useState<
    string | null
  >(
    null,
  );

  /*
   * ====================================================
   * DETALLE / EDICIÓN
   * ====================================================
   */

  const [
    incidenciaSeleccionada,
    setIncidenciaSeleccionada,
  ] = useState<
    IncidenciaMapa | null
  >(
    null,
  );

  const [
    editandoIncidencia,
    setEditandoIncidencia,
  ] = useState(
    false,
  );

  const [
    tituloEdicion,
    setTituloEdicion,
  ] = useState(
    '',
  );

  const [
    descripcionEdicion,
    setDescripcionEdicion,
  ] = useState(
    '',
  );

  const [
    prioridadEdicion,
    setPrioridadEdicion,
  ] = useState<
    PrioridadIncidencia
  >(
    'MEDIA',
  );

  const [
    estadoEdicion,
    setEstadoEdicion,
  ] = useState<
    EstadoIncidencia
  >(
    'PENDIENTE',
  );

  const [
    puntoEdicion,
    setPuntoEdicion,
  ] = useState<
    PuntoMapa | null
  >(
    null,
  );

  const [
    fotografiaEdicionId,
    setFotografiaEdicionId,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    panoramicaEdicionId,
    setPanoramicaEdicionId,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    guardandoEdicion,
    setGuardandoEdicion,
  ] = useState(
    false,
  );

  const [
    eliminandoIncidencia,
    setEliminandoIncidencia,
  ] = useState(
    false,
  );

  const [
    errorEdicion,
    setErrorEdicion,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    confirmacionEliminarAbierta,
    setConfirmacionEliminarAbierta,
  ] = useState(
    false,
  );

  /*
   * ====================================================
   * LIMPIEZA
   * ====================================================
   */

  function limpiarNuevaIncidencia() {
    setTipoNuevaIncidencia(
      'TEXTO',
    );

    setPuntoNuevaIncidencia(
      null,
    );

    setFotografiaSeleccionadaId(
      '',
    );

    setPanoramicaSeleccionadaId(
      '',
    );

    setTituloIncidencia(
      '',
    );

    setDescripcionIncidencia(
      '',
    );

    setPrioridadIncidencia(
      'MEDIA',
    );

    setErrorIncidencia(
      null,
    );

    marcadorNuevaIncidencia.current?.remove();

    marcadorNuevaIncidencia.current =
      null;
  }

  function cerrarPanelIncidencia() {
    setPanelIncidenciaAbierto(
      false,
    );

    limpiarNuevaIncidencia();
  }

  function limpiarEdicionIncidencia() {
    setEditandoIncidencia(
      false,
    );

    setTituloEdicion(
      '',
    );

    setDescripcionEdicion(
      '',
    );

    setPrioridadEdicion(
      'MEDIA',
    );

    setEstadoEdicion(
      'PENDIENTE',
    );

    setPuntoEdicion(
      null,
    );

    setFotografiaEdicionId(
      null,
    );

    setPanoramicaEdicionId(
      null,
    );

    setErrorEdicion(
      null,
    );

    marcadorEdicionIncidencia.current?.remove();

    marcadorEdicionIncidencia.current =
      null;
  }

  function cerrarDetalleIncidencia() {
    setFotografiaAbierta(null);
    setPanoramicaAbierta(null);

    setConfirmacionEliminarAbierta(
      false,
    );

    limpiarEdicionIncidencia();

    setIncidenciaSeleccionada(
      null,
    );
  }

  function colocarMarcadorEdicion(
    punto:
      PuntoMapa,
  ) {
    const mapaActual =
      map.current;

    if (
      !mapaActual
    ) {
      return;
    }

    marcadorEdicionIncidencia.current?.remove();

    const marcador =
      new mapboxgl.Marker({
        color:
          '#ea751a',

        draggable:
          true,
      })
        .setLngLat([
          punto.longitud,
          punto.latitud,
        ])
        .addTo(
          mapaActual,
        );

    marcador.on(
      'dragend',
      () => {
        const posicion =
          marcador.getLngLat();

        setPuntoEdicion({
          latitud:
            posicion.lat,

          longitud:
            posicion.lng,
        });

        setErrorEdicion(
          null,
        );
      },
    );

    marcadorEdicionIncidencia.current =
      marcador;
  }

  function abrirDetalleIncidencia(
    incidencia:
      IncidenciaMapa,
  ) {
    setFotografiaAbierta(null);
    setPanoramicaAbierta(null);

    cerrarPanelIncidencia();

    setPanelCapasAbierto(
      false,
    );

    limpiarEdicionIncidencia();

    setConfirmacionEliminarAbierta(
      false,
    );

    setIncidenciaSeleccionada(
      incidencia,
    );
  }

  function iniciarEdicionIncidencia() {
    setFotografiaAbierta(null);
    setPanoramicaAbierta(null);

    if (
      !incidenciaSeleccionada
    ) {
      return;
    }

    const punto:
      PuntoMapa = {
      latitud:
        incidenciaSeleccionada.latitud,

      longitud:
        incidenciaSeleccionada.longitud,
    };

    setTituloEdicion(
      incidenciaSeleccionada.titulo,
    );

    setDescripcionEdicion(
      incidenciaSeleccionada.descripcion,
    );

    setPrioridadEdicion(
      incidenciaSeleccionada.prioridad,
    );

    setEstadoEdicion(
      incidenciaSeleccionada.estado,
    );

    setPuntoEdicion(
      punto,
    );

    setFotografiaEdicionId(
      incidenciaSeleccionada.id_fotografia ??
      null,
    );

    setPanoramicaEdicionId(
      incidenciaSeleccionada.id_panoramica ??
      null,
    );

    setErrorEdicion(
      null,
    );

    setEditandoIncidencia(
      true,
    );

    colocarMarcadorEdicion(
      punto,
    );
  }

  /*
   * ====================================================
   * CREAR MAPA
   * ====================================================
   */

  
useEffect(() => {
  const accessToken =
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  const contenedorMapa = mapContainer.current;

  if (
    !contenedorMapa ||
    map.current ||
    !accessToken
  ) {
    return;
  }

  mapboxgl.accessToken = accessToken;

  const nuevoMapa = new mapboxgl.Map({
    container: contenedorMapa,

    style: 'mapbox://styles/mapbox/streets-v12',

    center: CENTRO_INICIAL,

    zoom: 4.5,

    attributionControl: true,
  });

  nuevoMapa.addControl(
    new mapboxgl.NavigationControl(),
    'top-right',
  );

  map.current = nuevoMapa;

  /*
   * ============================================
   * AJUSTE AUTOMÁTICO DEL TAMAÑO DEL MAPA
   * ============================================
   */

  const observadorTamanio = new ResizeObserver(() => {
    if (map.current !== nuevoMapa) {
      return;
    }

    nuevoMapa.resize();
  });

  observadorTamanio.observe(contenedorMapa);

  nuevoMapa.once('load', () => {
    if (map.current === nuevoMapa) {
      nuevoMapa.resize();
    }
  });

  /*
   * ============================================
   * LIMPIEZA
   * ============================================
   */

  return () => {
    observadorTamanio.disconnect();

    marcadores.current.forEach(
      ({
        marcador,
        popup,
      }) => {
        popup.remove();
        marcador.remove();
      },
    );

    marcadores.current = [];

    marcadoresIncidencias.current.forEach(
      (marcador) => {
        marcador.remove();
      },
    );

    marcadoresIncidencias.current = [];

    marcadorNuevaIncidencia.current?.remove();

    marcadorNuevaIncidencia.current = null;

    marcadorEdicionIncidencia.current?.remove();

    marcadorEdicionIncidencia.current = null;

    nuevoMapa.remove();

    map.current = null;
  };
}, []);


  /*
   * ====================================================
   * MARCADORES DE PROYECTOS
   * ====================================================
   */
  useEffect(() => {
    const mapaActual =
      map.current;

    if (
      !mapaActual
    ) {
      return;
    }

    marcadores.current.forEach(
      ({
        marcador,
        popup,
      }) => {
        popup.remove();

        marcador.remove();
      },
    );

    marcadores.current =
      [];

    if (
      !mostrarMarcadores
    ) {
      return;
    }

    const proyectosConCoordenadas =
      proyectos.filter(
        (
          proyecto,
        ) =>
          proyecto.latitud !==
          null &&
          proyecto.longitud !==
          null,
      );

    if (
      proyectosConCoordenadas.length ===
      0
    ) {
      mapaActual.flyTo({
        center:
          CENTRO_INICIAL,

        zoom:
          4.5,
      });

      return;
    }

    const bounds =
      new mapboxgl.LngLatBounds();

    proyectosConCoordenadas.forEach(
      (
        proyecto,
      ) => {
        if (
          proyecto.latitud ===
          null ||
          proyecto.longitud ===
          null
        ) {
          return;
        }

        const popup =
          new mapboxgl.Popup({
            offset:
              18,
          }).setDOMContent(
            crearContenidoPopup(
              proyecto,
            ),
          );

        const marcador =
          new mapboxgl.Marker({
            color:
              '#ea751a',
          })
            .setLngLat([
              proyecto.longitud,
              proyecto.latitud,
            ])
            .setPopup(
              popup,
            )
            .addTo(
              mapaActual,
            );

        marcadores.current.push({
          idProyecto:
            proyecto.id_proyecto,

          marcador,

          popup,
        });

        bounds.extend([
          proyecto.longitud,
          proyecto.latitud,
        ]);
      },
    );

    if (
      proyectosConCoordenadas.length ===
      1
    ) {
      const proyecto =
        proyectosConCoordenadas[
        0
        ];

      if (
        proyecto.latitud !==
        null &&
        proyecto.longitud !==
        null
      ) {
        mapaActual.flyTo({
          center: [
            proyecto.longitud,
            proyecto.latitud,
          ],

          zoom:
            13,
        });
      }

      return;
    }

    mapaActual.fitBounds(
      bounds,
      {
        padding:
          60,

        maxZoom:
          13,
      },
    );
  }, [
    proyectos,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * ENFOCAR PROYECTO
   * ====================================================
   */

  useEffect(() => {
    if (
      !mostrarMarcadores
    ) {
      return;
    }

    const mapaActual =
      map.current;

    if (
      !mapaActual ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    const proyectoSeleccionado =
      proyectos.find(
        (
          proyecto,
        ) =>
          proyecto.id_proyecto ===
          proyectoSeleccionadoId,
      );

    if (
      !proyectoSeleccionado ||
      proyectoSeleccionado.latitud ===
      null ||
      proyectoSeleccionado.longitud ===
      null
    ) {
      return;
    }

    const marcadorSeleccionado =
      marcadores.current.find(
        ({
          idProyecto,
        }) =>
          idProyecto ===
          proyectoSeleccionadoId,
      );

    mapaActual.flyTo({
      center: [
        proyectoSeleccionado.longitud,
        proyectoSeleccionado.latitud,
      ],

      zoom:
        14,

      essential:
        true,
    });

    if (
      marcadorSeleccionado &&
      !marcadorSeleccionado.popup.isOpen()
    ) {
      marcadorSeleccionado.marcador
        .togglePopup();
    }
  }, [
    proyectoSeleccionadoId,
    proyectos,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * LIMPIAR AL CAMBIAR PROYECTO
   * ====================================================
   */

  useEffect(() => {
    setCapasMapa(
      [],
    );

    setFotografiasMapa(
      [],
    );

    setPanoramicasMapa(
      [],
    );

    setIncidenciasMapa(
      [],
    );

    setFotografiaAbierta(null);

    setPanoramicaAbierta(
      null,
    );

    setPanelCapasAbierto(
      false,
    );

    setModalSubirCapaAbierto(
      false,
    );

    setPanelIncidenciaAbierto(
      false,
    );

    setIncidenciaSeleccionada(
      null,
    );

    setConfirmacionEliminarAbierta(
      false,
    );

    limpiarNuevaIncidencia();

    limpiarEdicionIncidencia();

    marcadoresIncidencias.current.forEach(
      (
        marcador,
      ) => {
        marcador.remove();
      },
    );

    marcadoresIncidencias.current =
      [];

    capaPendienteZoomRef.current =
      null;

    enfoqueInicialRealizadoRef.current =
      false;

    navegacionExternaAplicadaRef.current =
      null;

    tileJsonCache.current.clear();
  }, [
    proyectoSeleccionadoId,
  ]);

  /*
   * ====================================================
   * CARGAR CAPAS
   * ====================================================
   */

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    let activo =
      true;

    async function cargarCapas() {
      try {
        const respuesta =
          await listarCapasProyecto(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        setCapasMapa(
          respuesta.capas,
        );
      } catch (
      error
      ) {
        console.error(
          'No fue posible cargar las capas del mapa del proyecto.',
          error,
        );
      }
    }

    void cargarCapas();

    return () => {
      activo =
        false;
    };
  }, [
    proyectoSeleccionadoId,
    mostrarMarcadores,
  ]);

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    let activo =
      true;

    const eventos =
      new EventSource(
        '/api/notificaciones/eventos',
      );

    async function actualizarOrtofotos() {
      try {
        const respuesta =
          await listarCapasProyecto(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        setCapasMapa(
          respuesta.capas,
        );

        setVersionPanelCapas(
          (
            actual,
          ) =>
            actual +
            1,
        );
      } catch {
        // Conservamos las ortofotos actuales.
      }
    }

    async function actualizarIncidencias() {
      try {
        const primeraPagina =
          await listarIncidenciasMapa(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        let incidencias = [
          ...primeraPagina.incidencias,
        ];

        for (
          let pagina =
            2;
          pagina <=
          primeraPagina.total_paginas;
          pagina +=
          1
        ) {
          const respuesta =
            await listarIncidenciasMapa(
              proyectoSeleccionadoId!,
              {
                pagina,

                limite:
                  100,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          incidencias = [
            ...incidencias,
            ...respuesta.incidencias,
          ];
        }

        setIncidenciasMapa(
          incidencias,
        );

        setIncidenciaSeleccionada(
          (
            actual,
          ) => {
            if (
              !actual
            ) {
              return null;
            }

            return (
              incidencias.find(
                (
                  incidencia,
                ) =>
                  incidencia.id_incidencia ===
                  actual.id_incidencia,
              ) ??
              null
            );
          },
        );
      } catch {
        // Conservamos las incidencias actuales.
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
        proyectoSeleccionadoId
      ) {
        return;
      }

      if (
        datos.recurso ===
        'ORTOFOTOS'
      ) {
        void actualizarOrtofotos();

        return;
      }

      if (
        datos.recurso ===
        'INCIDENCIAS'
      ) {
        void actualizarIncidencias();
      }
    }

    eventos.addEventListener(
      'proyecto',
      manejarCambioProyecto,
    );

    eventos.onerror =
      () => {
        // EventSource se reconecta automáticamente.
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
    proyectoSeleccionadoId,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * CARGAR FOTOGRAFÍAS
   * ====================================================
   */

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    let activo =
      true;

    async function cargarFotografias() {
      try {
        const primeraPagina =
          await listarFotografiasProyecto(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        let fotografias = [
          ...primeraPagina.fotografias,
        ];

        for (
          let pagina =
            2;
          pagina <=
          primeraPagina.total_paginas;
          pagina +=
          1
        ) {
          const respuesta =
            await listarFotografiasProyecto(
              proyectoSeleccionadoId!,
              {
                pagina,

                limite:
                  100,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          fotografias = [
            ...fotografias,
            ...respuesta.fotografias,
          ];
        }

        setFotografiasMapa(
          fotografias,
        );
      } catch (
      error
      ) {
        console.error(
          'No fue posible cargar las fotografías disponibles para incidencias.',
          error,
        );
      }
    }

    void cargarFotografias();

    return () => {
      activo =
        false;
    };
  }, [
    proyectoSeleccionadoId,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * CARGAR PANORÁMICAS
   * ====================================================
   */

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    let activo =
      true;

    async function cargarPanoramicas() {
      try {
        const primeraPagina =
          await listarPanoramicasProyecto(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        let panoramicas = [
          ...primeraPagina.panoramicas,
        ];

        for (
          let pagina =
            2;
          pagina <=
          primeraPagina.total_paginas;
          pagina +=
          1
        ) {
          const respuesta =
            await listarPanoramicasProyecto(
              proyectoSeleccionadoId!,
              {
                pagina,

                limite:
                  100,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          panoramicas = [
            ...panoramicas,
            ...respuesta.panoramicas,
          ];
        }

        setPanoramicasMapa(
          panoramicas,
        );
      } catch (
      error
      ) {
        console.error(
          'No fue posible cargar las panorámicas disponibles para incidencias.',
          error,
        );
      }
    }

    void cargarPanoramicas();

    return () => {
      activo =
        false;
    };
  }, [
    proyectoSeleccionadoId,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * CARGAR INCIDENCIAS
   * ====================================================
   */

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !proyectoSeleccionadoId
    ) {
      return;
    }

    let activo =
      true;

    async function cargarIncidencias() {
      try {
        const primeraPagina =
          await listarIncidenciasMapa(
            proyectoSeleccionadoId!,
            {
              pagina:
                1,

              limite:
                100,
            },
          );

        if (
          !activo
        ) {
          return;
        }

        let incidencias = [
          ...primeraPagina.incidencias,
        ];

        for (
          let pagina =
            2;
          pagina <=
          primeraPagina.total_paginas;
          pagina +=
          1
        ) {
          const respuesta =
            await listarIncidenciasMapa(
              proyectoSeleccionadoId!,
              {
                pagina,

                limite:
                  100,
              },
            );

          if (
            !activo
          ) {
            return;
          }

          incidencias = [
            ...incidencias,
            ...respuesta.incidencias,
          ];
        }

        setIncidenciasMapa(
          incidencias,
        );
      } catch (
      error
      ) {
        console.error(
          'No fue posible cargar las incidencias del mapa.',
          error,
        );
      }
    }

    void cargarIncidencias();

    return () => {
      activo =
        false;
    };
  }, [
    proyectoSeleccionadoId,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * NAVEGACIÓN DESDE NOTIFICACIÓN
   * ====================================================
   */

  useEffect(() => {
    if (
      mostrarMarcadores ||
      !navegacionClave ||
      navegacionExternaAplicadaRef.current ===
      navegacionClave
    ) {
      return;
    }

    if (
      abrirCapasInicialmente
    ) {
      navegacionExternaAplicadaRef.current =
        navegacionClave;

      cerrarPanelIncidencia();

      cerrarDetalleIncidencia();

      setPanelCapasAbierto(
        true,
      );

      return;
    }

    if (
      !incidenciaInicialId
    ) {
      return;
    }

    const incidencia =
      incidenciasMapa.find(
        (
          item,
        ) =>
          item.id_incidencia ===
          incidenciaInicialId,
      );

    const mapaActual =
      map.current;

    if (
      !incidencia ||
      !mapaActual
    ) {
      return;
    }

    navegacionExternaAplicadaRef.current =
      navegacionClave;

    abrirDetalleIncidencia(
      incidencia,
    );

    mapaActual.flyTo({
      center: [
        incidencia.longitud,
        incidencia.latitud,
      ],

      zoom:
        18,

      essential:
        true,
    });
  }, [
    abrirCapasInicialmente,
    incidenciaInicialId,
    incidenciasMapa,
    mostrarMarcadores,
    navegacionClave,
  ]);

  /*
   * ====================================================
   * MARCADORES DE INCIDENCIAS
   * ====================================================
   */

  useEffect(() => {
    const mapaActual =
      map.current;

    if (
      !mapaActual ||
      mostrarMarcadores
    ) {
      return;
    }

    marcadoresIncidencias.current.forEach(
      (
        marcador,
      ) => {
        marcador.remove();
      },
    );

    marcadoresIncidencias.current =
      [];

    incidenciasMapa.forEach(
      (
        incidencia,
      ) => {
        const elemento =
          document.createElement(
            'button',
          );

        elemento.type =
          'button';

        elemento.title =
          incidencia.titulo;

        if (
          incidencia.id_fotografia
        ) {
          elemento.className =
            styles.incidentPhotoMarker;

          elemento.setAttribute(
            'aria-label',
            `Incidencia con fotografía: ${incidencia.titulo}`,
          );

          elemento.innerHTML = `
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z"
              ></path>

              <circle
                cx="12"
                cy="13"
                r="3.2"
              ></circle>
            </svg>
          `;
        } else if (
          incidencia.id_panoramica
        ) {
          elemento.className =
            styles.incidentPanoramaMarker;

          elemento.setAttribute(
            'aria-label',
            `Incidencia con panorámica 360: ${incidencia.titulo}`,
          );

          elemento.textContent =
            '360°';
        } else {
          elemento.className =
            styles.incidentTextMarker;

          elemento.setAttribute(
            'aria-label',
            `Incidencia: ${incidencia.titulo}`,
          );

          elemento.textContent =
            '!';
        }

        elemento.addEventListener(
          'click',
          (
            event,
          ) => {
            event.preventDefault();

            event.stopPropagation();

            abrirDetalleIncidencia(
              incidencia,
            );
          },
        );

        const marcador =
          new mapboxgl.Marker({
            element:
              elemento,

            anchor:
              'center',
          })
            .setLngLat([
              incidencia.longitud,
              incidencia.latitud,
            ])
            .addTo(
              mapaActual,
            );

        marcadoresIncidencias.current.push(
          marcador,
        );
      },
    );

    return () => {
      marcadoresIncidencias.current.forEach(
        (
          marcador,
        ) => {
          marcador.remove();
        },
      );

      marcadoresIncidencias.current =
        [];
    };
  }, [
    incidenciasMapa,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * PUNTO NUEVA INCIDENCIA
   * ====================================================
   */

  useEffect(() => {
    const mapaActual =
      map.current;

    if (
      !mapaActual ||
      mostrarMarcadores ||
      !panelIncidenciaAbierto
    ) {
      return;
    }

    const mapaDisponible =
      mapaActual;

    function seleccionarPunto(
      evento:
        mapboxgl.MapMouseEvent,
    ) {
      const punto:
        PuntoMapa = {
        latitud:
          evento.lngLat.lat,

        longitud:
          evento.lngLat.lng,
      };

      setPuntoNuevaIncidencia(
        punto,
      );

      setErrorIncidencia(
        null,
      );

      marcadorNuevaIncidencia.current?.remove();

      marcadorNuevaIncidencia.current =
        new mapboxgl.Marker({
          color:
            '#ea751a',
        })
          .setLngLat([
            punto.longitud,
            punto.latitud,
          ])
          .addTo(
            mapaDisponible,
          );
    }

    mapaDisponible.on(
      'click',
      seleccionarPunto,
    );

    mapaDisponible.getCanvas().style.cursor =
      'crosshair';

    return () => {
      mapaDisponible.off(
        'click',
        seleccionarPunto,
      );

      mapaDisponible.getCanvas().style.cursor =
        '';
    };
  }, [
    panelIncidenciaAbierto,
    mostrarMarcadores,
  ]);
  /*
 * ====================================================
 * CAMBIAR UBICACIÓN DURANTE EDICIÓN
 * ====================================================
 */

  useEffect(() => {
    const mapaActual =
      map.current;

    if (
      !mapaActual ||
      mostrarMarcadores ||
      !editandoIncidencia ||
      !incidenciaSeleccionada
    ) {
      return;
    }

    const mapaDisponible =
      mapaActual;

    function seleccionarPunto(
      evento:
        mapboxgl.MapMouseEvent,
    ) {
      const punto:
        PuntoMapa = {
        latitud:
          evento.lngLat.lat,

        longitud:
          evento.lngLat.lng,
      };

      setPuntoEdicion(
        punto,
      );

      setErrorEdicion(
        null,
      );

      colocarMarcadorEdicion(
        punto,
      );
    }

    mapaDisponible.on(
      'click',
      seleccionarPunto,
    );

    mapaDisponible.getCanvas().style.cursor =
      'crosshair';

    return () => {
      mapaDisponible.off(
        'click',
        seleccionarPunto,
      );

      mapaDisponible.getCanvas().style.cursor =
        '';
    };
  }, [
    editandoIncidencia,
    incidenciaSeleccionada,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * CREAR INCIDENCIA
   * ====================================================
   */

  async function guardarNuevaIncidencia() {
    if (
      !proyectoSeleccionadoId ||
      guardandoIncidencia
    ) {
      return;
    }

    const titulo =
      tituloIncidencia.trim();

    const descripcion =
      descripcionIncidencia.trim();

    if (
      !titulo
    ) {
      setErrorIncidencia(
        'Escribe un título para la incidencia.',
      );

      return;
    }

    if (
      !descripcion
    ) {
      setErrorIncidencia(
        'Escribe una descripción para la incidencia.',
      );

      return;
    }

    if (
      !puntoNuevaIncidencia
    ) {
      setErrorIncidencia(
        'Haz clic sobre el mapa para seleccionar la ubicación de la incidencia.',
      );

      return;
    }

    try {
      setGuardandoIncidencia(
        true,
      );

      setErrorIncidencia(
        null,
      );

      let nuevaIncidencia:
        IncidenciaMapa;

      if (
        tipoNuevaIncidencia ===
        'TEXTO'
      ) {
        nuevaIncidencia =
          await crearIncidenciaMapa(
            proyectoSeleccionadoId,
            {
              titulo,

              descripcion,

              prioridad:
                prioridadIncidencia,

              latitud:
                puntoNuevaIncidencia.latitud,

              longitud:
                puntoNuevaIncidencia.longitud,
            },
          );
      } else if (
        tipoNuevaIncidencia ===
        'FOTOGRAFIA'
      ) {
        if (
          !fotografiaSeleccionadaId
        ) {
          setErrorIncidencia(
            'Selecciona una fotografía de la galería.',
          );

          return;
        }

        nuevaIncidencia =
          await crearIncidenciaMapa(
            proyectoSeleccionadoId,
            {
              titulo,

              descripcion,

              prioridad:
                prioridadIncidencia,

              latitud:
                puntoNuevaIncidencia.latitud,

              longitud:
                puntoNuevaIncidencia.longitud,

              id_fotografia:
                fotografiaSeleccionadaId,
            },
          );
      } else {
        if (
          !panoramicaSeleccionadaId
        ) {
          setErrorIncidencia(
            'Selecciona una panorámica 360°.',
          );

          return;
        }

        nuevaIncidencia =
          await crearIncidenciaMapa(
            proyectoSeleccionadoId,
            {
              titulo,

              descripcion,

              prioridad:
                prioridadIncidencia,

              latitud:
                puntoNuevaIncidencia.latitud,

              longitud:
                puntoNuevaIncidencia.longitud,

              id_panoramica:
                panoramicaSeleccionadaId,
            },
          );
      }

      setIncidenciasMapa(
        (
          actuales,
        ) => [
            nuevaIncidencia,
            ...actuales.filter(
              (
                incidencia,
              ) =>
                incidencia.id_incidencia !==
                nuevaIncidencia.id_incidencia,
            ),
          ],
      );

      cerrarPanelIncidencia();
    } catch (
    error
    ) {
      console.error(
        'No fue posible crear la incidencia.',
        error,
      );

      setErrorIncidencia(
        error instanceof Error
          ? error.message
          : 'No fue posible crear la incidencia.',
      );
    } finally {
      setGuardandoIncidencia(
        false,
      );
    }
  }

  /*
   * ====================================================
   * EDITAR INCIDENCIA
   * ====================================================
   */

  async function guardarEdicionIncidencia() {
    if (
      !proyectoSeleccionadoId ||
      !incidenciaSeleccionada ||
      !puntoEdicion ||
      guardandoEdicion
    ) {
      return;
    }

    const titulo =
      tituloEdicion.trim();

    const descripcion =
      descripcionEdicion.trim();

    if (
      !titulo
    ) {
      setErrorEdicion(
        'El título es obligatorio.',
      );

      return;
    }

    if (
      !descripcion
    ) {
      setErrorEdicion(
        'La descripción es obligatoria.',
      );

      return;
    }

    if (
      incidenciaSeleccionada.id_fotografia &&
      !fotografiaEdicionId
    ) {
      setErrorEdicion(
        'Selecciona una fotografía para la incidencia.',
      );

      return;
    }

    if (
      incidenciaSeleccionada.id_panoramica &&
      !panoramicaEdicionId
    ) {
      setErrorEdicion(
        'Selecciona una panorámica 360° para la incidencia.',
      );

      return;
    }
    try {
      setGuardandoEdicion(
        true,
      );

      setErrorEdicion(
        null,
      );

      const actualizada =
        await actualizarIncidenciaMapa(
          proyectoSeleccionadoId,
          incidenciaSeleccionada.id_incidencia,
          {
            titulo,

            descripcion,

            prioridad:
              prioridadEdicion,

            estado:
              estadoEdicion,

            latitud:
              puntoEdicion.latitud,

            longitud:
              puntoEdicion.longitud,

            id_fotografia:
              incidenciaSeleccionada.id_fotografia
                ? fotografiaEdicionId
                : undefined,

            id_panoramica:
              incidenciaSeleccionada.id_panoramica
                ? panoramicaEdicionId
                : undefined,
          },
        );

      setIncidenciasMapa(
        (
          actuales,
        ) =>
          actuales.map(
            (
              incidencia,
            ) =>
              incidencia.id_incidencia ===
                actualizada.id_incidencia
                ? actualizada
                : incidencia,
          ),
      );

      setIncidenciaSeleccionada(
        actualizada,
      );

      setEditandoIncidencia(
        false,
      );

      setPuntoEdicion(
        null,
      );

      marcadorEdicionIncidencia.current?.remove();

      marcadorEdicionIncidencia.current =
        null;
    } catch (
    error
    ) {
      console.error(
        'No fue posible actualizar la incidencia.',
        error,
      );

      setErrorEdicion(
        error instanceof Error
          ? error.message
          : 'No fue posible actualizar la incidencia.',
      );
    } finally {
      setGuardandoEdicion(
        false,
      );
    }
  }

  /*
   * ====================================================
   * ELIMINAR INCIDENCIA
   * ====================================================
   */

  async function eliminarIncidenciaSeleccionada() {
    if (
      !proyectoSeleccionadoId ||
      !incidenciaSeleccionada ||
      eliminandoIncidencia
    ) {
      return;
    }

    try {
      setEliminandoIncidencia(
        true,
      );

      setErrorEdicion(
        null,
      );

      await eliminarIncidenciaMapa(
        proyectoSeleccionadoId,
        incidenciaSeleccionada.id_incidencia,
      );

      const idEliminada =
        incidenciaSeleccionada.id_incidencia;

      setIncidenciasMapa(
        (
          actuales,
        ) =>
          actuales.filter(
            (
              incidencia,
            ) =>
              incidencia.id_incidencia !==
              idEliminada,
          ),
      );

      setConfirmacionEliminarAbierta(
        false,
      );

      cerrarDetalleIncidencia();
    } catch (
    error
    ) {
      console.error(
        'No fue posible eliminar la incidencia.',
        error,
      );

      setErrorEdicion(
        error instanceof Error
          ? error.message
          : 'No fue posible eliminar la incidencia.',
      );

      setConfirmacionEliminarAbierta(
        false,
      );
    } finally {
      setEliminandoIncidencia(
        false,
      );
    }
  }

  /*
   * ====================================================
   * SINCRONIZAR CAPAS / ORTOFOTOS
   * ====================================================
   */

  useEffect(() => {
    const mapaInstancia =
      map.current;

    if (
      !mapaInstancia
    ) {
      return;
    }

    let activo =
      true;

    async function sincronizarCapas() {
      const mapaActual =
        map.current;

      if (
        !activo ||
        !mapaActual
      ) {
        return;
      }

      const capasListas =
        capasMapa
          .filter(
            (
              capa,
            ) =>
              capa.estado_procesamiento ===
              'LISTA' &&
              capa.teselas !==
              null,
          )
          .sort(
            (
              a,
              b,
            ) =>
              a.orden -
              b.orden,
          );

      const idsPermitidos =
        new Set(
          capasListas.map(
            (
              capa,
            ) =>
              obtenerLayerId(
                capa.id_capa,
              ),
          ),
        );

      const estilo =
        mapaActual.getStyle();

      const layersExistentes =
        estilo.layers
          ? [
            ...estilo.layers,
          ]
          : [];

      layersExistentes.forEach(
        (
          layer,
        ) => {
          if (
            !layer.id.startsWith(
              'ingevit-capa-layer-',
            )
          ) {
            return;
          }

          if (
            idsPermitidos.has(
              layer.id,
            )
          ) {
            return;
          }

          if (
            mapaActual.getLayer(
              layer.id,
            )
          ) {
            mapaActual.removeLayer(
              layer.id,
            );
          }

          const idCapa =
            layer.id.replace(
              'ingevit-capa-layer-',
              '',
            );

          const sourceId =
            obtenerSourceId(
              idCapa,
            );

          if (
            mapaActual.getSource(
              sourceId,
            )
          ) {
            mapaActual.removeSource(
              sourceId,
            );
          }
        },
      );

      for (
        const capa
        of capasListas
      ) {
        if (
          !activo ||
          !capa.teselas
        ) {
          continue;
        }

        const sourceId =
          obtenerSourceId(
            capa.id_capa,
          );

        const layerId =
          obtenerLayerId(
            capa.id_capa,
          );

        const cacheKey =
          `${capa.id_capa}:${capa.teselas.version}`;

        let tileJson =
          tileJsonCache.current.get(
            cacheKey,
          );

        if (
          !tileJson
        ) {
          try {
            tileJson =
              await obtenerTileJsonCapa(
                capa.id_proyecto,
                capa.id_capa,
                capa.teselas.version,
              );

            if (
              !activo
            ) {
              return;
            }

            tileJsonCache.current.set(
              cacheKey,
              tileJson,
            );
          } catch (
          error
          ) {
            console.error(
              `No fue posible cargar el TileJSON de "${capa.nombre}".`,
              error,
            );

            continue;
          }
        }

        const mapaDespuesDeEspera =
          map.current;

        if (
          !activo ||
          !mapaDespuesDeEspera
        ) {
          return;
        }

        if (
          !mapaDespuesDeEspera.getSource(
            sourceId,
          )
        ) {
          mapaDespuesDeEspera.addSource(
            sourceId,
            {
              type:
                'raster',

              tiles:
                tileJson.tiles,

              tileSize:
                capa.teselas.tamano,

              minzoom:
                tileJson.minzoom,

              maxzoom:
                tileJson.maxzoom,

              bounds:
                tileJson.bounds,
            },
          );
        }

        if (
          !mapaDespuesDeEspera.getLayer(
            layerId,
          )
        ) {
          mapaDespuesDeEspera.addLayer({
            id:
              layerId,

            type:
              'raster',

            source:
              sourceId,

            layout: {
              visibility:
                capa.visible
                  ? 'visible'
                  : 'none',
            },

            paint: {
              'raster-opacity':
                capa.opacidad,
            },
          });
        } else {
          mapaDespuesDeEspera.setLayoutProperty(
            layerId,
            'visibility',
            capa.visible
              ? 'visible'
              : 'none',
          );

          mapaDespuesDeEspera.setPaintProperty(
            layerId,
            'raster-opacity',
            capa.opacidad,
          );
        }

        if (
          capaPendienteZoomRef.current ===
          capa.id_capa
        ) {
          const limites =
            capa.bbox ??
            tileJson.bounds;

          mapaDespuesDeEspera.fitBounds(
            [
              [
                limites[0],
                limites[1],
              ],

              [
                limites[2],
                limites[3],
              ],
            ],
            {
              padding: {
                top:
                  60,

                right:
                  panelCapasAbierto
                    ? 390
                    : 60,

                bottom:
                  60,

                left:
                  60,
              },

              maxZoom:
                19,

              duration:
                1200,
            },
          );

          capaPendienteZoomRef.current =
            null;

          enfoqueInicialRealizadoRef.current =
            true;
        }
      }

      const mapaParaOrden =
        map.current;

      if (
        !activo ||
        !mapaParaOrden
      ) {
        return;
      }

      capasListas.forEach(
        (
          capa,
        ) => {
          const layerId =
            obtenerLayerId(
              capa.id_capa,
            );

          if (
            mapaParaOrden.getLayer(
              layerId,
            )
          ) {
            mapaParaOrden.moveLayer(
              layerId,
            );
          }
        },
      );

      if (
        !mostrarMarcadores &&
        !enfoqueInicialRealizadoRef.current &&
        capasListas.length >
        0
      ) {
        const capaParaEnfocar =
          [
            ...capasListas,
          ]
            .reverse()
            .find(
              (
                capa,
              ) =>
                capa.visible,
            ) ??
          capasListas[
          capasListas.length -
          1
          ];

        const tileJsonEnfoque =
          capaParaEnfocar.teselas
            ? tileJsonCache.current.get(
              `${capaParaEnfocar.id_capa}:${capaParaEnfocar.teselas.version}`,
            )
            : undefined;

        const limites =
          capaParaEnfocar.bbox ??
          tileJsonEnfoque?.bounds;

        if (
          limites
        ) {
          mapaParaOrden.fitBounds(
            [
              [
                limites[0],
                limites[1],
              ],

              [
                limites[2],
                limites[3],
              ],
            ],
            {
              padding: {
                top:
                  60,

                right:
                  panelCapasAbierto
                    ? 390
                    : 60,

                bottom:
                  60,

                left:
                  60,
              },

              maxZoom:
                19,

              duration:
                1000,
            },
          );

          enfoqueInicialRealizadoRef.current =
            true;
        }
      }
    }

    function ejecutar() {
      void sincronizarCapas();
    }

    if (
      mapaInstancia.isStyleLoaded()
    ) {
      ejecutar();
    } else {
      mapaInstancia.once(
        'load',
        ejecutar,
      );
    }

    return () => {
      activo =
        false;

      mapaInstancia.off(
        'load',
        ejecutar,
      );
    };
  }, [
    capasMapa,
    panelCapasAbierto,
    mostrarMarcadores,
  ]);

  /*
   * ====================================================
   * DATOS DERIVADOS
   * ====================================================
   */

  const tokenConfigurado =
    Boolean(
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN,
    );

  const proyectoSeleccionado =
    proyectoSeleccionadoId
      ? proyectos.find(
        (
          proyecto,
        ) =>
          proyecto.id_proyecto ===
          proyectoSeleccionadoId,
      ) ??
      null
      : null;

  const fotografiaSeleccionada =
    fotografiaSeleccionadaId
      ? fotografiasMapa.find(
        (
          fotografia,
        ) =>
          fotografia.id_fotografia ===
          fotografiaSeleccionadaId,
      ) ??
      null
      : null;

  const panoramicaSeleccionada =
    panoramicaSeleccionadaId
      ? panoramicasMapa.find(
        (
          panoramica,
        ) =>
          panoramica.id_panoramica ===
          panoramicaSeleccionadaId,
      ) ??
      null
      : null;

  const fotografiaDetalle =
    incidenciaSeleccionada
      ?.id_fotografia
      ? fotografiasMapa.find(
        (
          fotografia,
        ) =>
          fotografia.id_fotografia ===
          incidenciaSeleccionada.id_fotografia,
      ) ??
      null
      : null;

  const panoramicaDetalle =
    incidenciaSeleccionada
      ?.id_panoramica
      ? panoramicasMapa.find(
        (
          panoramica,
        ) =>
          panoramica.id_panoramica ===
          incidenciaSeleccionada.id_panoramica,
      ) ??
      null
      : null;

  /*
   * ====================================================
   * RENDER
   * ====================================================
   */
  return (
    <div
      className={
        styles.wrapper
      }
    >
      {!tokenConfigurado && (
        <div
          className={
            styles.configuration
          }
          role="alert"
        >
          <strong>
            Mapbox no está configurado
          </strong>

          <span>
            Agrega VITE_MAPBOX_ACCESS_TOKEN al entorno del frontend.
          </span>
        </div>
      )}

      <div
        className={
          styles.map
        }
        ref={
          mapContainer
        }
        aria-label={
          mostrarMarcadores
            ? 'Mapa de proyectos'
            : 'Mapa del proyecto'
        }
      />

      {tokenConfigurado &&
        proyectoSeleccionado &&
        !mostrarMarcadores && (
          <div
            className={
              styles.mapActions
            }
          >
            <button
              className={
                styles.layersButton
              }
              type="button"
              onClick={() => {
                cerrarPanelIncidencia();

                cerrarDetalleIncidencia();

                setPanelCapasAbierto(
                  (
                    actual,
                  ) =>
                    !actual,
                );
              }}
              aria-expanded={
                panelCapasAbierto
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m12 3 8 4-8 4-8-4 8-4Z" />

                <path d="m4 12 8 4 8-4" />

                <path d="m4 17 8 4 8-4" />
              </svg>

              <span>
                Capas
              </span>
            </button>

            <button
              className={
                styles.addIncidentButton
              }
              type="button"
              onClick={() => {
                setPanelCapasAbierto(
                  false,
                );

                cerrarDetalleIncidencia();

                setPanelIncidenciaAbierto(
                  (
                    actual,
                  ) => {
                    if (
                      actual
                    ) {
                      limpiarNuevaIncidencia();
                    }

                    return !actual;
                  },
                );
              }}
              aria-expanded={
                panelIncidenciaAbierto
              }
            >
              <span
                aria-hidden="true"
              >
                +
              </span>

              <span>
                Agregar incidencia
              </span>
            </button>
          </div>
        )}

      {panelCapasAbierto &&
        proyectoSeleccionadoId && (
          <MapLayersPanel
            key={`${proyectoSeleccionadoId}-${versionPanelCapas}`}
            idProyecto={
              proyectoSeleccionadoId
            }
            onCerrar={() => {
              setPanelCapasAbierto(
                false,
              );
            }}
            onSubirCapa={() => {
              setModalSubirCapaAbierto(
                true,
              );
            }}
            onCapasChange={
              setCapasMapa
            }
          />
        )}

      {incidenciaSeleccionada &&
        proyectoSeleccionadoId && (
          <aside
            className={
              styles.incidentPanel
            }
            aria-label="Detalle de incidencia"
          >
            <div
              className={
                styles.incidentPanelHeader
              }
            >
              <div>
                <span
                  className={
                    styles.incidentPanelEyebrow
                  }
                >
                  {
                    obtenerTipoIncidencia(
                      incidenciaSeleccionada,
                    )
                  }
                </span>

                <h3>
                  {editandoIncidencia
                    ? 'Editar incidencia'
                    : incidenciaSeleccionada.titulo}
                </h3>
              </div>

              <button
                type="button"
                className={
                  styles.incidentPanelClose
                }
                onClick={
                  cerrarDetalleIncidencia
                }
                disabled={
                  guardandoEdicion ||
                  eliminandoIncidencia
                }
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {!editandoIncidencia && (
              <>
                {fotografiaDetalle && (
                  <div
                    className={
                      styles.incidentMediaSection
                    }
                  >
                    <div
                      className={
                        styles.incidentMediaPreview
                      }
                    >
                      <img
                        src={
                          fotografiaDetalle.url
                        }
                        alt={
                          fotografiaDetalle.titulo
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.incidentSelectedMedia
                      }
                    >
                      <span>
                        Fotografía vinculada
                      </span>

                      <strong>
                        {
                          fotografiaDetalle.titulo
                        }
                      </strong>
                    </div>

                    <button
                      type="button"
                      className={styles.incidentCancelButton}
                      onClick={() => {
                        setPanoramicaAbierta(null);
                        setFotografiaAbierta(fotografiaDetalle);
                      }}
                    >
                      Abrir fotografía
                    </button>
                  </div>
                )}

                {panoramicaDetalle && (
                  <div
                    className={
                      styles.incidentMediaSection
                    }
                  >
                    <div
                      className={
                        styles.incidentMediaPreview
                      }
                    >
                      <img
                        src={
                          panoramicaDetalle.url
                        }
                        alt={
                          panoramicaDetalle.titulo
                        }
                      />

                      <span
                        className={
                          styles.incidentMedia360Badge
                        }
                      >
                        360°
                      </span>
                    </div>

                    <div
                      className={
                        styles.incidentSelectedMedia
                      }
                    >
                      <span>
                        Panorámica vinculada
                      </span>

                      <strong>
                        {
                          panoramicaDetalle.titulo
                        }
                      </strong>
                    </div>

                    <button
                      type="button"
                      className={
                        styles.incidentCancelButton
                      }
                      onClick={() => {
                        setFotografiaAbierta(null);
                        setPanoramicaAbierta(
                          panoramicaDetalle,
                        );
                      }}
                    >
                      Abrir panorámica 360°
                    </button>
                  </div>
                )}

                <div
                  className={
                    styles.incidentSelectedMedia
                  }
                >
                  <span>
                    Descripción
                  </span>

                  <strong
                    style={{
                      whiteSpace:
                        'normal',

                      overflow:
                        'visible',

                      textOverflow:
                        'initial',

                      lineHeight:
                        1.45,
                    }}
                  >
                    {
                      incidenciaSeleccionada.descripcion
                    }
                  </strong>
                </div>

                <div
                  className={
                    styles.incidentLocationBox
                  }
                >
                  <strong>
                    Estado
                  </strong>

                  <span>
                    {
                      obtenerTextoEstado(
                        incidenciaSeleccionada.estado,
                      )
                    }
                  </span>

                  <strong
                    style={{
                      marginTop:
                        '0.45rem',
                    }}
                  >
                    Prioridad
                  </strong>

                  <span>
                    {
                      obtenerTextoPrioridad(
                        incidenciaSeleccionada.prioridad,
                      )
                    }
                  </span>
                </div>

                <div
                  className={
                    styles.incidentLocationBox
                  }
                >
                  <strong>
                    Ubicación
                  </strong>

                  <span>
                    Latitud:{' '}
                    {incidenciaSeleccionada.latitud.toFixed(
                      6,
                    )}
                  </span>

                  <span>
                    Longitud:{' '}
                    {incidenciaSeleccionada.longitud.toFixed(
                      6,
                    )}
                  </span>
                </div>

                {errorEdicion && (
                  <div
                    className={
                      styles.incidentError
                    }
                    role="alert"
                  >
                    {errorEdicion}
                  </div>
                )}

                <div
                  className={
                    styles.incidentActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.incidentCancelButton
                    }
                    style={{
                      color:
                        '#9b3526',

                      borderColor:
                        'rgb(155 53 38 / 24%)',

                      background:
                        '#fff7f5',
                    }}
                    onClick={() => {
                      setConfirmacionEliminarAbierta(
                        true,
                      );
                    }}
                    disabled={
                      eliminandoIncidencia ||
                      guardandoEdicion
                    }
                  >
                    {eliminandoIncidencia
                      ? 'Eliminando...'
                      : 'Eliminar'}
                  </button>

                  <button
                    type="button"
                    className={
                      styles.incidentSaveButton
                    }
                    onClick={
                      iniciarEdicionIncidencia
                    }
                    disabled={
                      eliminandoIncidencia
                    }
                  >
                    Editar
                  </button>
                </div>
              </>
            )}

            {editandoIncidencia && (
              <>
                {incidenciaSeleccionada.id_fotografia && (
                  <label
                    className={
                      styles.incidentField
                    }
                  >
                    <span>
                      Fotografía vinculada
                    </span>

                    <select
                      value={
                        fotografiaEdicionId ??
                        ''
                      }
                      onChange={(
                        event,
                      ) => {
                        setFotografiaEdicionId(
                          event.target.value ||
                          null,
                        );

                        setErrorEdicion(
                          null,
                        );
                      }}
                    >
                      <option value="">
                        Selecciona una fotografía
                      </option>

                      {fotografiasMapa.map(
                        (
                          fotografia,
                        ) => (
                          <option
                            key={
                              fotografia.id_fotografia
                            }
                            value={
                              fotografia.id_fotografia
                            }
                          >
                            {
                              fotografia.titulo
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}

                {incidenciaSeleccionada.id_panoramica && (
                  <label
                    className={
                      styles.incidentField
                    }
                  >
                    <span>
                      Panorámica vinculada
                    </span>

                    <select
                      value={
                        panoramicaEdicionId ??
                        ''
                      }
                      onChange={(
                        event,
                      ) => {
                        setPanoramicaEdicionId(
                          event.target.value ||
                          null,
                        );

                        setErrorEdicion(
                          null,
                        );
                      }}
                    >
                      <option value="">
                        Selecciona una panorámica 360°
                      </option>

                      {panoramicasMapa.map(
                        (
                          panoramica,
                        ) => (
                          <option
                            key={
                              panoramica.id_panoramica
                            }
                            value={
                              panoramica.id_panoramica
                            }
                          >
                            {
                              panoramica.titulo
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}

                <div
                  className={
                    styles.incidentLocationBox
                  }
                >
                  <strong>
                    Ubicación de la incidencia
                  </strong>

                  {puntoEdicion && (
                    <>
                      <span>
                        Latitud:{' '}
                        {puntoEdicion.latitud.toFixed(
                          6,
                        )}
                      </span>

                      <span>
                        Longitud:{' '}
                        {puntoEdicion.longitud.toFixed(
                          6,
                        )}
                      </span>
                    </>
                  )}

                  <small>
                    Haz clic en otro punto del mapa o arrastra el marcador naranja para mover la incidencia.
                  </small>
                </div>

                <label
                  className={
                    styles.incidentField
                  }
                >
                  <span>
                    Título
                  </span>

                  <input
                    type="text"
                    value={
                      tituloEdicion
                    }
                    maxLength={
                      200
                    }
                    onChange={(
                      event,
                    ) => {
                      setTituloEdicion(
                        event.target.value,
                      );

                      setErrorEdicion(
                        null,
                      );
                    }}
                  />
                </label>

                <label
                  className={
                    styles.incidentField
                  }
                >
                  <span>
                    Descripción
                  </span>

                  <textarea
                    value={
                      descripcionEdicion
                    }
                    onChange={(
                      event,
                    ) => {
                      setDescripcionEdicion(
                        event.target.value,
                      );

                      setErrorEdicion(
                        null,
                      );
                    }}
                    rows={
                      4
                    }
                  />
                </label>

                <label
                  className={
                    styles.incidentField
                  }
                >
                  <span>
                    Prioridad
                  </span>

                  <select
                    value={
                      prioridadEdicion
                    }
                    onChange={(
                      event,
                    ) => {
                      setPrioridadEdicion(
                        event.target.value as
                        PrioridadIncidencia,
                      );
                    }}
                  >
                    <option value="BAJA">
                      Baja
                    </option>

                    <option value="MEDIA">
                      Media
                    </option>

                    <option value="ALTA">
                      Alta
                    </option>
                  </select>
                </label>

                <label
                  className={
                    styles.incidentField
                  }
                >
                  <span>
                    Estado
                  </span>

                  <select
                    value={
                      estadoEdicion
                    }
                    onChange={(
                      event,
                    ) => {
                      setEstadoEdicion(
                        event.target.value as
                        EstadoIncidencia,
                      );
                    }}
                  >
                    <option value="PENDIENTE">
                      Pendiente
                    </option>

                    <option value="EN_PROCESO">
                      En proceso
                    </option>

                    <option value="SOLUCIONADA">
                      Solucionada
                    </option>
                  </select>
                </label>

                {errorEdicion && (
                  <div
                    className={
                      styles.incidentError
                    }
                    role="alert"
                  >
                    {errorEdicion}
                  </div>
                )}

                <div
                  className={
                    styles.incidentActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.incidentCancelButton
                    }
                    onClick={() => {
                      limpiarEdicionIncidencia();
                    }}
                    disabled={
                      guardandoEdicion
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className={
                      styles.incidentSaveButton
                    }
                    onClick={() => {
                      void guardarEdicionIncidencia();
                    }}
                    disabled={
                      guardandoEdicion
                    }
                  >
                    {guardandoEdicion
                      ? 'Guardando...'
                      : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </aside>
        )}

      {panelIncidenciaAbierto &&
        proyectoSeleccionadoId && (
          <aside
            className={
              styles.incidentPanel
            }
            aria-label="Nueva incidencia"
          >
            <div
              className={
                styles.incidentPanelHeader
              }
            >
              <div>
                <span
                  className={
                    styles.incidentPanelEyebrow
                  }
                >
                  Mapa
                </span>

                <h3>
                  Nueva incidencia
                </h3>
              </div>

              <button
                type="button"
                className={
                  styles.incidentPanelClose
                }
                onClick={
                  cerrarPanelIncidencia
                }
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div
              className={
                styles.incidentTypeGrid
              }
            >
              <button
                type="button"
                className={
                  tipoNuevaIncidencia ===
                    'TEXTO'
                    ? styles.incidentTypeActive
                    : styles.incidentTypeButton
                }
                onClick={() => {
                  setTipoNuevaIncidencia(
                    'TEXTO',
                  );

                  setFotografiaSeleccionadaId(
                    '',
                  );

                  setPanoramicaSeleccionadaId(
                    '',
                  );

                  setErrorIncidencia(
                    null,
                  );
                }}
              >
                <strong>
                  Texto
                </strong>

                <span>
                  Solo incidencia
                </span>
              </button>

              <button
                type="button"
                className={
                  tipoNuevaIncidencia ===
                    'FOTOGRAFIA'
                    ? styles.incidentTypeActive
                    : styles.incidentTypeButton
                }
                onClick={() => {
                  setTipoNuevaIncidencia(
                    'FOTOGRAFIA',
                  );

                  setPanoramicaSeleccionadaId(
                    '',
                  );

                  setErrorIncidencia(
                    null,
                  );
                }}
              >
                <strong>
                  Foto
                </strong>

                <span>
                  Desde galería
                </span>
              </button>

              <button
                type="button"
                className={
                  tipoNuevaIncidencia ===
                    'PANORAMICA'
                    ? styles.incidentTypeActive
                    : styles.incidentTypeButton
                }
                onClick={() => {
                  setTipoNuevaIncidencia(
                    'PANORAMICA',
                  );

                  setFotografiaSeleccionadaId(
                    '',
                  );

                  setErrorIncidencia(
                    null,
                  );
                }}
              >
                <strong>
                  360°
                </strong>

                <span>
                  Panorámica
                </span>
              </button>
            </div>

            {tipoNuevaIncidencia ===
              'FOTOGRAFIA' && (
                <div
                  className={
                    styles.incidentMediaSection
                  }
                >
                  <div
                    className={
                      styles.incidentMediaHeader
                    }
                  >
                    <strong>
                      Selecciona una fotografía
                    </strong>

                    <span>
                      {fotografiasMapa.length}{' '}
                      disponibles
                    </span>
                  </div>

                  {fotografiasMapa.length >
                    0 ? (
                    <div
                      className={
                        styles.incidentMediaGrid
                      }
                    >
                      {fotografiasMapa.map(
                        (
                          fotografia,
                        ) => {
                          const seleccionada =
                            fotografia.id_fotografia ===
                            fotografiaSeleccionadaId;

                          return (
                            <button
                              key={
                                fotografia.id_fotografia
                              }
                              type="button"
                              className={
                                seleccionada
                                  ? styles.incidentMediaCardActive
                                  : styles.incidentMediaCard
                              }
                              onClick={() => {
                                setFotografiaSeleccionadaId(
                                  fotografia.id_fotografia,
                                );

                                setErrorIncidencia(
                                  null,
                                );
                              }}
                              aria-pressed={
                                seleccionada
                              }
                            >
                              <div
                                className={
                                  styles.incidentMediaPreview
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

                                {seleccionada && (
                                  <span
                                    className={
                                      styles.incidentMediaCheck
                                    }
                                    aria-hidden="true"
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>

                              <span
                                className={
                                  styles.incidentMediaTitle
                                }
                              >
                                {
                                  fotografia.titulo
                                }
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div
                      className={
                        styles.incidentMediaEmpty
                      }
                    >
                      No hay fotografías disponibles en la galería.
                    </div>
                  )}

                  {fotografiaSeleccionada && (
                    <div
                      className={
                        styles.incidentSelectedMedia
                      }
                    >
                      <span>
                        Fotografía seleccionada
                      </span>

                      <strong>
                        {
                          fotografiaSeleccionada.titulo
                        }
                      </strong>
                    </div>
                  )}
                </div>
              )}

            {tipoNuevaIncidencia ===
              'PANORAMICA' && (
                <div
                  className={
                    styles.incidentMediaSection
                  }
                >
                  <div
                    className={
                      styles.incidentMediaHeader
                    }
                  >
                    <strong>
                      Selecciona una panorámica
                    </strong>

                    <span>
                      {panoramicasMapa.length}{' '}
                      disponibles
                    </span>
                  </div>

                  {panoramicasMapa.length >
                    0 ? (
                    <div
                      className={
                        styles.incidentMediaGrid
                      }
                    >
                      {panoramicasMapa.map(
                        (
                          panoramica,
                        ) => {
                          const seleccionada =
                            panoramica.id_panoramica ===
                            panoramicaSeleccionadaId;

                          return (
                            <button
                              key={
                                panoramica.id_panoramica
                              }
                              type="button"
                              className={
                                seleccionada
                                  ? styles.incidentMediaCardActive
                                  : styles.incidentMediaCard
                              }
                              onClick={() => {
                                setPanoramicaSeleccionadaId(
                                  panoramica.id_panoramica,
                                );

                                setErrorIncidencia(
                                  null,
                                );
                              }}
                              aria-pressed={
                                seleccionada
                              }
                            >
                              <div
                                className={
                                  styles.incidentMediaPreview
                                }
                              >
                                <img
                                  src={
                                    panoramica.url
                                  }
                                  alt={
                                    panoramica.titulo
                                  }
                                  loading="lazy"
                                />

                                <span
                                  className={
                                    styles.incidentMedia360Badge
                                  }
                                >
                                  360°
                                </span>

                                {seleccionada && (
                                  <span
                                    className={
                                      styles.incidentMediaCheck
                                    }
                                    aria-hidden="true"
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>

                              <span
                                className={
                                  styles.incidentMediaTitle
                                }
                              >
                                {
                                  panoramica.titulo
                                }
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div
                      className={
                        styles.incidentMediaEmpty
                      }
                    >
                      No hay panorámicas 360° disponibles.
                    </div>
                  )}

                  {panoramicaSeleccionada && (
                    <div
                      className={
                        styles.incidentSelectedMedia
                      }
                    >
                      <span>
                        Panorámica seleccionada
                      </span>

                      <strong>
                        {
                          panoramicaSeleccionada.titulo
                        }
                      </strong>
                    </div>
                  )}
                </div>
              )}
            <div
              className={
                styles.incidentLocationBox
              }
            >
              {puntoNuevaIncidencia ? (
                <>
                  <strong>
                    Ubicación seleccionada
                  </strong>

                  <span>
                    Latitud:{' '}
                    {puntoNuevaIncidencia.latitud.toFixed(
                      6,
                    )}
                  </span>

                  <span>
                    Longitud:{' '}
                    {puntoNuevaIncidencia.longitud.toFixed(
                      6,
                    )}
                  </span>

                  <small>
                    Haz clic en otro punto del mapa para cambiar la ubicación.
                  </small>
                </>
              ) : (
                <>
                  <strong>
                    Selecciona la ubicación
                  </strong>

                  <span>
                    Haz clic sobre el mapa donde se encuentra la incidencia.
                  </span>

                  {tipoNuevaIncidencia ===
                    'FOTOGRAFIA' && (
                      <small>
                        La ubicación se asignará a la incidencia, no a la fotografía.
                      </small>
                    )}

                  {tipoNuevaIncidencia ===
                    'PANORAMICA' && (
                      <small>
                        La ubicación se asignará a la incidencia, no a la panorámica.
                      </small>
                    )}
                </>
              )}
            </div>

            <label
              className={
                styles.incidentField
              }
            >
              <span>
                Título
              </span>

              <input
                type="text"
                value={
                  tituloIncidencia
                }
                maxLength={
                  200
                }
                onChange={(
                  event,
                ) => {
                  setTituloIncidencia(
                    event.target.value,
                  );

                  setErrorIncidencia(
                    null,
                  );
                }}
                placeholder="Ej. Fisura en muro"
              />
            </label>

            <label
              className={
                styles.incidentField
              }
            >
              <span>
                Descripción
              </span>

              <textarea
                value={
                  descripcionIncidencia
                }
                onChange={(
                  event,
                ) => {
                  setDescripcionIncidencia(
                    event.target.value,
                  );

                  setErrorIncidencia(
                    null,
                  );
                }}
                placeholder="Describe lo encontrado..."
                rows={
                  4
                }
              />
            </label>

            <label
              className={
                styles.incidentField
              }
            >
              <span>
                Prioridad
              </span>

              <select
                value={
                  prioridadIncidencia
                }
                onChange={(
                  event,
                ) => {
                  setPrioridadIncidencia(
                    event.target.value as
                    PrioridadIncidencia,
                  );
                }}
              >
                <option value="BAJA">
                  Baja
                </option>

                <option value="MEDIA">
                  Media
                </option>

                <option value="ALTA">
                  Alta
                </option>
              </select>
            </label>

            {errorIncidencia && (
              <div
                className={
                  styles.incidentError
                }
                role="alert"
              >
                {errorIncidencia}
              </div>
            )}

            <div
              className={
                styles.incidentActions
              }
            >
              <button
                type="button"
                className={
                  styles.incidentCancelButton
                }
                onClick={
                  cerrarPanelIncidencia
                }
                disabled={
                  guardandoIncidencia
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  styles.incidentSaveButton
                }
                onClick={() => {
                  void guardarNuevaIncidencia();
                }}
                disabled={
                  guardandoIncidencia
                }
              >
                {guardandoIncidencia
                  ? 'Guardando...'
                  : 'Crear incidencia'}
              </button>
            </div>
          </aside>
        )}

      {confirmacionEliminarAbierta &&
        incidenciaSeleccionada && (
          <div
            className={
              styles.deleteConfirmOverlay
            }
            role="presentation"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget &&
                !eliminandoIncidencia
              ) {
                setConfirmacionEliminarAbierta(
                  false,
                );
              }
            }}
          >
            <section
              className={
                styles.deleteConfirmModal
              }
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-incident-title"
              aria-describedby="delete-incident-description"
            >
              <div
                className={
                  styles.deleteConfirmIcon
                }
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                >
                  <path d="M4 7h16" />

                  <path d="M10 11v6" />

                  <path d="M14 11v6" />

                  <path d="M6 7l1 13h10l1-13" />

                  <path d="M9 7V4h6v3" />
                </svg>
              </div>

              <div
                className={
                  styles.deleteConfirmContent
                }
              >
                <span
                  className={
                    styles.deleteConfirmEyebrow
                  }
                >
                  Eliminar incidencia
                </span>

                <h3
                  id="delete-incident-title"
                >
                  ¿Eliminar esta incidencia?
                </h3>

                <p
                  id="delete-incident-description"
                >
                  La incidencia{' '}
                  <strong>
                    “{
                      incidenciaSeleccionada.titulo
                    }”
                  </strong>{' '}
                  será eliminada permanentemente.
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <div
                className={
                  styles.deleteConfirmActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.deleteConfirmCancel
                  }
                  onClick={() => {
                    setConfirmacionEliminarAbierta(
                      false,
                    );
                  }}
                  disabled={
                    eliminandoIncidencia
                  }
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className={
                    styles.deleteConfirmButton
                  }
                  onClick={() => {
                    void eliminarIncidenciaSeleccionada();
                  }}
                  disabled={
                    eliminandoIncidencia
                  }
                >
                  {eliminandoIncidencia
                    ? 'Eliminando...'
                    : 'Sí, eliminar'}
                </button>
              </div>
            </section>
          </div>
        )}

      {modalSubirCapaAbierto &&
        proyectoSeleccionadoId && (
          <UploadLayerModal
            idProyecto={
              proyectoSeleccionadoId
            }
            onCerrar={() => {
              setModalSubirCapaAbierto(
                false,
              );
            }}
            onSubida={(
              nuevaCapa,
            ) => {
              capaPendienteZoomRef.current =
                nuevaCapa.id_capa;

              setModalSubirCapaAbierto(
                false,
              );

              setPanelCapasAbierto(
                true,
              );

              setVersionPanelCapas(
                (
                  actual,
                ) =>
                  actual +
                  1,
              );
            }}
          />
        )}

      {fotografiaAbierta && (
        <dialog
          ref={fotografiaDialogRef}
          aria-labelledby="projects-map-fotografia-titulo"
          aria-modal="true"
          onCancel={() => setFotografiaAbierta(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (
                event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom
              ) {
                setFotografiaAbierta(null);
              }
            }
          }}
          style={{
            boxSizing: 'border-box',
            width: 'min(1200px, calc(100vw - 24px))',
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'calc(100dvh - 24px)',
            margin: 'auto',
            padding: 'clamp(12px, 3vw, 24px)',
            border: 'none',
            borderRadius: 12,
            background: '#fff',
            color: '#182230',
            boxShadow: '0 20px 80px rgba(0, 0, 0, 0.4)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2
              id="projects-map-fotografia-titulo"
              style={{ margin: 0, fontSize: '1.125rem', overflowWrap: 'anywhere' }}
            >
              {fotografiaAbierta.titulo || 'Fotografía'}
            </h2>
            <button
              type="button"
              className={styles.incidentCancelButton}
              onClick={() => setFotografiaAbierta(null)}
              style={{ flexShrink: 0 }}
            >
              Cerrar
            </button>
          </div>
          <img
            src={fotografiaAbierta.url}
            alt={fotografiaAbierta.titulo || 'Fotografía de la incidencia'}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxHeight: 'calc(100dvh - 140px)',
              objectFit: 'contain',
              borderRadius: 8,
              background: '#f1f3f5',
            }}
          />
        </dialog>
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
    </div>
  );
}