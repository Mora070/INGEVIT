import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  actualizarConfiguracionCapa,
  listarCapasProyecto,
  reintentarCapaProyecto,
} from '../../api/capas.api';

import type {
  CapaProyecto,
} from '../../types/capa';

import {
  DeleteLayerModal,
} from '../DeleteLayerModal/DeleteLayerModal';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './MapLayersPanel.module.css';

interface MapLayersPanelProps {
  idProyecto: string;

  onCerrar: () => void;

  onSubirCapa: () => void;

  onCapasChange?: (
    capas: CapaProyecto[],
  ) => void;

  versionExterna?: number;
}

function obtenerEstadoTexto(
  capa: CapaProyecto,
): string {
  if (
    capa.estado_procesamiento ===
    'PENDIENTE'
  ) {
    return 'Pendiente';
  }

  if (
    capa.estado_procesamiento ===
    'PROCESANDO'
  ) {
    return 'Procesando';
  }

  if (
    capa.estado_procesamiento ===
    'LISTA'
  ) {
    return 'Lista';
  }

  return 'Error';
}

function obtenerClaseEstado(
  capa: CapaProyecto,
): string {
  if (
    capa.estado_procesamiento ===
    'PENDIENTE'
  ) {
    return styles.statusPending;
  }

  if (
    capa.estado_procesamiento ===
    'PROCESANDO'
  ) {
    return styles.statusProcessing;
  }

  if (
    capa.estado_procesamiento ===
    'LISTA'
  ) {
    return styles.statusReady;
  }

  return styles.statusError;
}

function formatearTamano(
  bytesTexto: string,
): string {
  const bytes =
    Number(bytesTexto);

  if (
    !Number.isFinite(bytes) ||
    bytes < 0
  ) {
    return bytesTexto;
  }

  if (
    bytes < 1024
  ) {
    return `${Math.round(
      bytes,
    )} B`;
  }

  const kilobytes =
    bytes / 1024;

  if (
    kilobytes < 1024
  ) {
    return `${kilobytes.toFixed(
      1,
    )} KB`;
  }

  const megabytes =
    kilobytes / 1024;

  if (
    megabytes < 1024
  ) {
    return `${megabytes.toFixed(
      1,
    )} MB`;
  }

  const gigabytes =
    megabytes / 1024;

  return `${gigabytes.toFixed(
    2,
  )} GB`;
}

export function MapLayersPanel({
  idProyecto,
  onCerrar,
  onSubirCapa,
  onCapasChange,
  versionExterna = 0,
}: MapLayersPanelProps) {
  const [
    capas,
    setCapas,
  ] = useState<CapaProyecto[]>(
    [],
  );

  const [
    cargando,
    setCargando,
  ] = useState(
    true,
  );

  const [
    guardandoId,
    setGuardandoId,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    reintentandoId,
    setReintentandoId,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    capaEliminando,
    setCapaEliminando,
  ] = useState<
    CapaProyecto | null
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

  /**
   * Se incrementa cuando necesitamos
   * forzar una nueva consulta al backend.
   *
   * Por ejemplo, después de reintentar
   * una capa que estaba en ERROR.
   */
  const [
    versionConsulta,
    setVersionConsulta,
  ] = useState(
    0,
  );

  /**
   * Temporizadores independientes
   * para el debounce de opacidad.
   */
  const temporizadoresOpacidad =
    useRef<
      Map<
        string,
        ReturnType<
          typeof setTimeout
        >
      >
    >(
      new Map(),
    );

  /**
   * Guarda la última opacidad que
   * sabemos que quedó persistida
   * correctamente en el backend.
   */
  const opacidadesPersistidas =
    useRef<
      Map<
        string,
        number
      >
    >(
      new Map(),
    );

  const capasOrdenadas =
    useMemo(
      () =>
        [...capas].sort(
          (
            a,
            b,
          ) =>
            b.orden -
            a.orden,
        ),
      [
        capas,
      ],
    );

  const hayCapasEnProceso =
    capas.some(
      (
        capa,
      ) =>
        capa.estado_procesamiento ===
        'PENDIENTE' ||
        capa.estado_procesamiento ===
        'PROCESANDO',
    );

  /**
   * Actualiza una capa localmente
   * y notifica al componente del mapa.
   */
  function actualizarCapaLocal(
    capaActualizada:
      CapaProyecto,
  ) {
    setCapas(
      (
        actuales,
      ) => {
        const nuevas =
          actuales.map(
            (
              capa,
            ) =>
              capa.id_capa ===
                capaActualizada.id_capa
                ? capaActualizada
                : capa,
          );

        onCapasChange?.(
          nuevas,
        );

        return nuevas;
      },
    );
  }

  /**
   * Consulta inicial de capas.
   *
   * Si existe alguna capa PENDIENTE
   * o PROCESANDO continúa consultando
   * cada 4 segundos.
   */
  useEffect(() => {
    let activo =
      true;

    let temporizador:
      ReturnType<
        typeof setTimeout
      > | null =
      null;

    async function cargar(
      mostrarCargaInicial:
        boolean,
    ) {
      if (mostrarCargaInicial) {
        setCargando((cargandoActual) => cargandoActual);
      }

      setError(
        null,
      );

      try {
        const respuesta =
          await listarCapasProyecto(
            idProyecto,
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

        /**
         * Si el usuario está moviendo
         * la opacidad de una capa,
         * evitamos que el polling
         * sobrescriba ese valor local.
         */
        setCapas(
          (
            actuales,
          ) => {
            const nuevas =
              respuesta.capas.map(
                (
                  capaServidor,
                ) => {
                  if (
                    !temporizadoresOpacidad.current.has(
                      capaServidor.id_capa,
                    )
                  ) {
                    opacidadesPersistidas.current.set(
                      capaServidor.id_capa,
                      capaServidor.opacidad,
                    );

                    return capaServidor;
                  }

                  const capaLocal =
                    actuales.find(
                      (
                        actual,
                      ) =>
                        actual.id_capa ===
                        capaServidor.id_capa,
                    );

                  if (
                    !capaLocal
                  ) {
                    return capaServidor;
                  }

                  return {
                    ...capaServidor,

                    opacidad:
                      capaLocal.opacidad,
                  };
                },
              );

            onCapasChange?.(
              nuevas,
            );

            return nuevas;
          },
        );

        const algunaProcesando =
          respuesta.capas.some(
            (
              capa,
            ) =>
              capa.estado_procesamiento ===
              'PENDIENTE' ||
              capa.estado_procesamiento ===
              'PROCESANDO',
          );

        if (
          algunaProcesando
        ) {
          temporizador =
            setTimeout(
              () => {
                void cargar(
                  false,
                );
              },
              4000,
            );
        }
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
            'No fue posible cargar las capas del proyecto.',
          );
        }
      } finally {
        if (
          activo &&
          mostrarCargaInicial
        ) {
          setCargando(
            false,
          );
        }
      }
    }

    void cargar(
      true,
    );

    return () => {
      activo =
        false;

      if (
        temporizador
      ) {
        clearTimeout(
          temporizador,
        );
      }
    };
  }, [
    idProyecto,
    onCapasChange,
    versionConsulta,
    versionExterna,
  ]);

  /**
   * Limpia los debounce pendientes
   * cuando se desmonta el panel.
   */
  useEffect(() => {
    const temporizadores =
      temporizadoresOpacidad.current;

    return () => {
      temporizadores.forEach(
        (
          temporizador,
        ) => {
          clearTimeout(
            temporizador,
          );
        },
      );

      temporizadores.clear();
    };
  }, []);

  /**
   * Activa/desactiva una capa.
   *
   * Se actualiza primero Mapbox
   * y después se persiste.
   */
  async function cambiarVisibilidad(
    capa: CapaProyecto,
  ) {
    if (
      guardandoId ||
      capa.estado_procesamiento !==
      'LISTA'
    ) {
      return;
    }

    const visibleAnterior =
      capa.visible;

    const capaLocal:
      CapaProyecto =
    {
      ...capa,

      visible:
        !visibleAnterior,
    };

    actualizarCapaLocal(
      capaLocal,
    );

    setGuardandoId(
      capa.id_capa,
    );

    setError(
      null,
    );

    try {
      const actualizada =
        await actualizarConfiguracionCapa(
          idProyecto,
          capa.id_capa,
          {
            opacidad:
              capa.opacidad,

            visible:
              !visibleAnterior,

            orden:
              capa.orden,
          },
        );

      opacidadesPersistidas.current.set(
        actualizada.id_capa,
        actualizada.opacidad,
      );

      actualizarCapaLocal(
        actualizada,
      );
    } catch (
    errorObtenido
    ) {
      actualizarCapaLocal({
        ...capa,

        visible:
          visibleAnterior,
      });

      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible cambiar la visibilidad de la capa.',
        );
      }
    } finally {
      setGuardandoId(
        null,
      );
    }
  }

  /**
   * Persiste la opacidad
   * después del debounce.
   */
  async function guardarOpacidad(
    capa: CapaProyecto,
    nuevaOpacidad: number,
  ) {
    setError(
      null,
    );

    try {
      const actualizada =
        await actualizarConfiguracionCapa(
          idProyecto,
          capa.id_capa,
          {
            opacidad:
              nuevaOpacidad,

            visible:
              capa.visible,

            orden:
              capa.orden,
          },
        );

      opacidadesPersistidas.current.set(
        capa.id_capa,
        actualizada.opacidad,
      );

      actualizarCapaLocal(
        actualizada,
      );
    } catch (
    errorObtenido
    ) {
      const opacidadAnterior =
        opacidadesPersistidas.current.get(
          capa.id_capa,
        );

      if (
        opacidadAnterior !==
        undefined
      ) {
        setCapas(
          (
            actuales,
          ) => {
            const nuevas =
              actuales.map(
                (
                  actual,
                ) =>
                  actual.id_capa ===
                    capa.id_capa
                    ? {
                      ...actual,

                      opacidad:
                        opacidadAnterior,
                    }
                    : actual,
              );

            onCapasChange?.(
              nuevas,
            );

            return nuevas;
          },
        );
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
          'No fue posible guardar la opacidad de la capa.',
        );
      }
    } finally {
      temporizadoresOpacidad.current.delete(
        capa.id_capa,
      );
    }
  }

  /**
   * Cambia inmediatamente la opacidad
   * del raster en el mapa.
   *
   * El PATCH se realiza únicamente
   * después de 500 ms sin movimiento.
   */
  function cambiarOpacidadLocal(
    capa: CapaProyecto,
    nuevaOpacidad: number,
  ) {
    if (
      capa.estado_procesamiento !==
      'LISTA'
    ) {
      return;
    }

    const normalizada =
      Math.min(
        1,
        Math.max(
          0,
          nuevaOpacidad,
        ),
      );

    const capaActualizada:
      CapaProyecto =
    {
      ...capa,

      opacidad:
        normalizada,
    };

    actualizarCapaLocal(
      capaActualizada,
    );

    const temporizadorAnterior =
      temporizadoresOpacidad.current.get(
        capa.id_capa,
      );

    if (
      temporizadorAnterior
    ) {
      clearTimeout(
        temporizadorAnterior,
      );
    }

    const nuevoTemporizador =
      setTimeout(
        () => {
          void guardarOpacidad(
            capaActualizada,
            normalizada,
          );
        },
        500,
      );

    temporizadoresOpacidad.current.set(
      capa.id_capa,
      nuevoTemporizador,
    );
  }

  /**
   * Mueve una capa hacia arriba
   * o hacia abajo.
   */
  async function moverCapa(
    idCapa: string,
    direccion:
      | 'arriba'
      | 'abajo',
  ) {
    if (
      guardandoId
    ) {
      return;
    }

    const ordenadas =
      [...capas].sort(
        (
          a,
          b,
        ) =>
          b.orden -
          a.orden,
      );

    const indice =
      ordenadas.findIndex(
        (
          capa,
        ) =>
          capa.id_capa ===
          idCapa,
      );

    if (
      indice === -1
    ) {
      return;
    }

    const nuevoIndice =
      direccion ===
        'arriba'
        ? indice - 1
        : indice + 1;

    if (
      nuevoIndice < 0 ||
      nuevoIndice >=
      ordenadas.length
    ) {
      return;
    }

    const copia =
      [...ordenadas];

    const temporal =
      copia[indice];

    copia[indice] =
      copia[
      nuevoIndice
      ];

    copia[
      nuevoIndice
    ] =
      temporal;

    const total =
      copia.length;

    const capasReordenadas =
      copia.map(
        (
          capa,
          posicion,
        ) => ({
          ...capa,

          orden:
            total -
            posicion,
        }),
      );

    const estadoAnterior =
      [...capas];

    setCapas(
      capasReordenadas,
    );

    onCapasChange?.(
      capasReordenadas,
    );

    setGuardandoId(
      idCapa,
    );

    setError(
      null,
    );

    try {
      const capasModificadas =
        capasReordenadas.filter(
          (
            nueva,
          ) => {
            const anterior =
              estadoAnterior.find(
                (
                  capa,
                ) =>
                  capa.id_capa ===
                  nueva.id_capa,
              );

            return (
              anterior &&
              anterior.orden !==
              nueva.orden
            );
          },
        );

      const resultados =
        await Promise.all(
          capasModificadas.map(
            (
              capa,
            ) =>
              actualizarConfiguracionCapa(
                idProyecto,
                capa.id_capa,
                {
                  opacidad:
                    capa.opacidad,

                  visible:
                    capa.visible,

                  orden:
                    capa.orden,
                },
              ),
          ),
        );

      setCapas(
        (
          actuales,
        ) => {
          const nuevas =
            actuales.map(
              (
                actual,
              ) => {
                const actualizada =
                  resultados.find(
                    (
                      resultado,
                    ) =>
                      resultado.id_capa ===
                      actual.id_capa,
                  );

                return (
                  actualizada ??
                  actual
                );
              },
            );

          onCapasChange?.(
            nuevas,
          );

          return nuevas;
        },
      );
    } catch (
    errorObtenido
    ) {
      setCapas(
        estadoAnterior,
      );

      onCapasChange?.(
        estadoAnterior,
      );

      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible cambiar el orden de las capas.',
        );
      }
    } finally {
      setGuardandoId(
        null,
      );
    }
  }

  /**
   * Reintenta una capa
   * cuyo procesamiento terminó
   * en ERROR.
   */
  async function reintentarCapa(
    capa: CapaProyecto,
  ) {
    if (
      reintentandoId ||
      capa.estado_procesamiento !==
      'ERROR'
    ) {
      return;
    }

    setReintentandoId(
      capa.id_capa,
    );

    setError(
      null,
    );

    try {
      await reintentarCapaProyecto(
        idProyecto,
        capa.id_capa,
      );

      /**
       * Cambio inmediato a PENDIENTE.
       */
      actualizarCapaLocal({
        ...capa,

        estado_procesamiento:
          'PENDIENTE',

        teselas:
          null,
      });

      /**
       * Forzamos una nueva consulta.
       *
       * Desde ahí el polling seguirá
       * mientras esté PENDIENTE
       * o PROCESANDO.
       */
      setVersionConsulta(
        (
          actual,
        ) =>
          actual +
          1,
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
          'No fue posible reintentar el procesamiento de la capa.',
        );
      }
    } finally {
      setReintentandoId(
        null,
      );
    }
  }

  /**
   * El backend ya eliminó
   * correctamente la capa.
   *
   * La quitamos del estado para que
   * ProjectsMap también elimine
   * su raster/source.
   */
  function capaEliminada(
    idCapa: string,
  ) {
    setCapas(
      (
        actuales,
      ) => {
        const nuevas =
          actuales.filter(
            (
              capa,
            ) =>
              capa.id_capa !==
              idCapa,
          );

        onCapasChange?.(
          nuevas,
        );

        return nuevas;
      },
    );

    opacidadesPersistidas.current.delete(
      idCapa,
    );

    const temporizador =
      temporizadoresOpacidad.current.get(
        idCapa,
      );

    if (
      temporizador
    ) {
      clearTimeout(
        temporizador,
      );

      temporizadoresOpacidad.current.delete(
        idCapa,
      );
    }

    setCapaEliminando(
      null,
    );

    setError(
      null,
    );
  }

  return (
    <>
      <aside
        className={
          styles.panel
        }
        aria-label="Capas del mapa"
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
            <strong>
              Capas
            </strong>

            <span>
              {hayCapasEnProceso
                ? 'Procesando ortofoto...'
                : 'Ortofotos y capas geográficas'}
            </span>
          </div>

          <button
            className={
              styles.closeButton
            }
            type="button"
            onClick={
              onCerrar
            }
            aria-label="Cerrar capas"
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
          {cargando ? (
            <div
              className={
                styles.empty
              }
            >
              Cargando capas...
            </div>
          ) : error &&
            capas.length ===
            0 ? (
            <div
              className={
                styles.empty
              }
            >
              {error}
            </div>
          ) : capasOrdenadas.length ===
            0 ? (
            <div
              className={
                styles.empty
              }
            >
              Este proyecto todavía no tiene capas.
              Puedes cargar una ortofoto GeoTIFF.
            </div>
          ) : (
            capasOrdenadas.map(
              (
                capa,
              ) => {
                const lista =
                  capa.estado_procesamiento ===
                  'LISTA' &&
                  capa.teselas !==
                  null;

                const guardando =
                  guardandoId ===
                  capa.id_capa;

                const reintentando =
                  reintentandoId ===
                  capa.id_capa;

                const porcentaje =
                  Math.round(
                    capa.opacidad *
                    100,
                  );

                const esPrimera =
                  capasOrdenadas[
                    0
                  ]?.id_capa ===
                  capa.id_capa;

                const esUltima =
                  capasOrdenadas[
                    capasOrdenadas.length -
                    1
                  ]?.id_capa ===
                  capa.id_capa;

                return (
                  <article
                    className={
                      styles.layerItem
                    }
                    key={
                      capa.id_capa
                    }
                  >
                    <div
                      className={
                        styles.layerTop
                      }
                    >
                      <div
                        className={
                          styles.layerInfo
                        }
                      >
                        <span
                          className={
                            styles.layerIcon
                          }
                          aria-hidden="true"
                        >
                          <svg
                            viewBox="0 0 24 24"
                          >
                            <path d="m12 3 8 4-8 4-8-4 8-4Z" />

                            <path d="m4 12 8 4 8-4" />

                            <path d="m4 17 8 4 8-4" />
                          </svg>
                        </span>

                        <div
                          className={
                            styles.layerText
                          }
                        >
                          <strong
                            title={
                              capa.nombre
                            }
                          >
                            {capa.nombre}
                          </strong>

                          <span
                            title={
                              capa.nombre_archivo_original
                            }
                          >
                            {
                              capa.nombre_archivo_original
                            }

                            {' · '}

                            {formatearTamano(
                              capa.tamano_original_bytes,
                            )}
                          </span>
                        </div>
                      </div>

                      <button
                        className={`${styles.switch} ${capa.visible
                          ? styles.switchActive
                          : ''
                          }`}
                        type="button"
                        role="switch"
                        aria-checked={
                          capa.visible
                        }
                        aria-label={`${capa.visible
                          ? 'Ocultar'
                          : 'Mostrar'
                          } ${capa.nombre}`}
                        onClick={() => {
                          void cambiarVisibilidad(
                            capa,
                          );
                        }}
                        disabled={
                          !lista ||
                          guardando
                        }
                      />
                    </div>

                    <span
                      className={`${styles.status} ${obtenerClaseEstado(
                        capa,
                      )}`}
                    >
                      {obtenerEstadoTexto(
                        capa,
                      )}
                    </span>

                    {capa.estado_procesamiento ===
                      'ERROR' && (
                        <button
                          className={
                            styles.retryButton
                          }
                          type="button"
                          disabled={
                            reintentando
                          }
                          onClick={() => {
                            void reintentarCapa(
                              capa,
                            );
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M20 6v5h-5" />

                            <path d="M4 18v-5h5" />

                            <path d="M6.1 9A7 7 0 0 1 18.5 7" />

                            <path d="M17.9 15A7 7 0 0 1 5.5 17" />
                          </svg>

                          {reintentando
                            ? 'Reintentando...'
                            : 'Reintentar procesamiento'}
                        </button>
                      )}

                    {capa.descripcion && (
                      <span
                        className={
                          styles.layerText
                        }
                      >
                        <span>
                          {
                            capa.descripcion
                          }
                        </span>
                      </span>
                    )}

                    <div
                      className={
                        styles.opacity
                      }
                    >
                      <div
                        className={
                          styles.opacityHeader
                        }
                      >
                        <span>
                          Opacidad
                        </span>

                        <strong>
                          {
                            porcentaje
                          }
                          %
                        </strong>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={
                          porcentaje
                        }
                        disabled={
                          !lista
                        }
                        onChange={(
                          event,
                        ) => {
                          const valor =
                            Number(
                              event.target.value,
                            ) /
                            100;

                          cambiarOpacidadLocal(
                            capa,
                            valor,
                          );
                        }}
                        aria-label={`Opacidad de ${capa.nombre}`}
                      />
                    </div>

                    <div
                      className={
                        styles.orderControls
                      }
                    >
                      <span>
                        Orden
                      </span>

                      <div
                        className={
                          styles.layerActions
                        }
                      >
                        <div
                          className={
                            styles.orderButtons
                          }
                        >
                          <button
                            type="button"
                            disabled={
                              guardando ||
                              esPrimera
                            }
                            onClick={() => {
                              void moverCapa(
                                capa.id_capa,
                                'arriba',
                              );
                            }}
                            aria-label={`Subir ${capa.nombre}`}
                            title="Mover arriba"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            disabled={
                              guardando ||
                              esUltima
                            }
                            onClick={() => {
                              void moverCapa(
                                capa.id_capa,
                                'abajo',
                              );
                            }}
                            aria-label={`Bajar ${capa.nombre}`}
                            title="Mover abajo"
                          >
                            ↓
                          </button>
                        </div>

                        <button
                          className={
                            styles.deleteLayerButton
                          }
                          type="button"
                          disabled={
                            guardando ||
                            reintentando
                          }
                          onClick={() => {
                            setCapaEliminando(
                              capa,
                            );
                          }}
                          aria-label={`Eliminar ${capa.nombre}`}
                          title="Eliminar ortofoto"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path d="M4 7h16" />

                            <path d="M9 7V4h6v3" />

                            <path d="M7 7l1 13h8l1-13" />

                            <path d="M10 11v5" />

                            <path d="M14 11v5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              },
            )
          )}

          {error &&
            capas.length >
            0 && (
              <div
                className={
                  styles.empty
                }
                role="alert"
              >
                {error}
              </div>
            )}
        </div>

        <footer
          className={
            styles.footer
          }
        >
          <button
            className={
              styles.uploadButton
            }
            type="button"
            onClick={
              onSubirCapa
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 19V5" />

              <path d="m7 10 5-5 5 5" />

              <path d="M5 19h14" />
            </svg>

            Subir ortofoto
          </button>
        </footer>
      </aside>

      {capaEliminando && (
        <DeleteLayerModal
          idProyecto={
            idProyecto
          }
          capa={
            capaEliminando
          }
          onCerrar={() => {
            setCapaEliminando(
              null,
            );
          }}
          onEliminada={
            capaEliminada
          }
        />
      )}
    </>
  );
}