import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  ReactNode,
} from 'react';

import type {
  Usuario,
} from '../../../auth/types/usuario';

import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerConteoNoLeidas,
} from '../../api/notificaciones.api';

import type {
  Notificacion,
} from '../../api/notificaciones.api';

import logoIngevit from '../../../../assets/branding/ingevit-logo2.png';

import styles from './AppShell.module.css';

export type SeccionWorkspace =
  | 'inicio'
  | 'proyectos'
  | 'perfil';

interface AppShellProps {
  usuario: Usuario;

  seccionActiva:
    SeccionWorkspace;

  children:
    ReactNode;

  onIrInicio:
    () => void;

  onIrProyectos:
    () => void;

  onIrPerfil:
    () => void;

  onAbrirNotificacion: (
    notificacion:
      Notificacion,
  ) => void;

  onCerrarSesion:
    () => void;

  cerrandoSesion?:
    boolean;
}

function obtenerIniciales(
  usuario: Usuario,
): string {
  const nombre =
    usuario.nombre?.trim() ??
    '';

  const apellidos =
    usuario.apellidos?.trim() ??
    '';

  if (
    nombre ||
    apellidos
  ) {
    const primera =
      nombre.charAt(0);

    const segunda =
      apellidos.charAt(0);

    return `${primera}${segunda}`
      .toUpperCase()
      .slice(
        0,
        2,
      );
  }

  return usuario.correo
    .slice(
      0,
      2,
    )
    .toUpperCase();
}

function obtenerNombreVisible(
  usuario: Usuario,
): string {
  const partes = [
    usuario.nombre?.trim(),
    usuario.apellidos?.trim(),
  ].filter(
    (
      valor,
    ): valor is string =>
      Boolean(valor),
  );

  if (
    partes.length >
    0
  ) {
    return partes.join(
      ' ',
    );
  }

  return usuario.correo;
}

function formatearFechaNotificacion(
  fecha: string,
): string {
  const fechaNotificacion =
    new Date(
      fecha,
    );

  const ahora =
    new Date();

  const diferenciaMs =
    ahora.getTime() -
    fechaNotificacion.getTime();

  const minutos =
    Math.floor(
      diferenciaMs /
        60_000,
    );

  if (
    minutos <
    1
  ) {
    return 'Ahora';
  }

  if (
    minutos <
    60
  ) {
    return `Hace ${minutos} min`;
  }

  const horas =
    Math.floor(
      minutos /
        60,
    );

  if (
    horas <
    24
  ) {
    return `Hace ${horas} h`;
  }

  const dias =
    Math.floor(
      horas /
        24,
    );

  if (
    dias <
    7
  ) {
    return `Hace ${dias} d`;
  }

  return fechaNotificacion.toLocaleDateString(
    'es-CO',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  );
}

export function AppShell({
  usuario,
  seccionActiva,
  children,
  onIrInicio,
  onIrProyectos,
  onIrPerfil,
  onAbrirNotificacion,
  onCerrarSesion,
  cerrandoSesion = false,
}: AppShellProps) {
  const [
    menuUsuarioAbierto,
    setMenuUsuarioAbierto,
  ] =
    useState(
      false,
    );

  const [
    notificacionesAbiertas,
    setNotificacionesAbiertas,
  ] =
    useState(
      false,
    );

  const [
    notificaciones,
    setNotificaciones,
  ] =
    useState<
      Notificacion[]
    >(
      [],
    );

  const [
    totalNoLeidas,
    setTotalNoLeidas,
  ] =
    useState(
      0,
    );

  const [
    cargandoNotificaciones,
    setCargandoNotificaciones,
  ] =
    useState(
      false,
    );

  const [
    errorNotificaciones,
    setErrorNotificaciones,
  ] =
    useState(
      '',
    );

  const [
    marcandoTodas,
    setMarcandoTodas,
  ] =
    useState(
      false,
    );

  const menuUsuarioRef =
    useRef<
      HTMLDivElement | null
    >(
      null,
    );

  const notificacionesRef =
    useRef<
      HTMLDivElement | null
    >(
      null,
    );

  const nombreVisible =
    obtenerNombreVisible(
      usuario,
    );

  const iniciales =
    obtenerIniciales(
      usuario,
    );

  const avatarUrl =
    useMemo(
      () => {
        if (
          !usuario.foto_perfil_url
        ) {
          return null;
        }

        const separador =
          usuario.foto_perfil_url.includes(
            '?',
          )
            ? '&'
            : '?';

        return `${usuario.foto_perfil_url}${separador}v=${Date.now()}`;
      },
      [
        usuario.foto_perfil_url,
      ],
    );

  useEffect(
    () => {
      let activo =
        true;

      async function cargarConteo() {
        try {
          const respuesta =
            await obtenerConteoNoLeidas();

          if (
            activo
          ) {
            setTotalNoLeidas(
              respuesta.total,
            );
          }
        } catch {
          // No bloqueamos la aplicación.
        }
      }

      void cargarConteo();

      const eventos =
        new EventSource(
          '/api/notificaciones/eventos',
        );

      eventos.addEventListener(
        'notificacion',
        () => {
          void cargarConteo();

          if (
            notificacionesAbiertas
          ) {
            void cargarNotificaciones();
          }
        },
      );

      eventos.onerror =
        () => {
          // EventSource se reconecta automáticamente.
        };

      function actualizarAlVolver() {
        void cargarConteo();
      }

      window.addEventListener(
        'focus',
        actualizarAlVolver,
      );

      return () => {
        activo =
          false;

        eventos.close();

        window.removeEventListener(
          'focus',
          actualizarAlVolver,
        );
      };
    },
    [
      usuario.id_usuario,
      notificacionesAbiertas,
    ],
  );

  useEffect(
    () => {
      function manejarClickExterior(
        event:
          MouseEvent,
      ) {
        const objetivo =
          event.target;

        if (
          !(
            objetivo instanceof
            Node
          )
        ) {
          return;
        }

        if (
          menuUsuarioRef.current &&
          !menuUsuarioRef.current.contains(
            objetivo,
          )
        ) {
          setMenuUsuarioAbierto(
            false,
          );
        }

        if (
          notificacionesRef.current &&
          !notificacionesRef.current.contains(
            objetivo,
          )
        ) {
          setNotificacionesAbiertas(
            false,
          );
        }
      }

      function manejarEscape(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key !==
          'Escape'
        ) {
          return;
        }

        setMenuUsuarioAbierto(
          false,
        );

        setNotificacionesAbiertas(
          false,
        );
      }

      document.addEventListener(
        'mousedown',
        manejarClickExterior,
      );

      document.addEventListener(
        'keydown',
        manejarEscape,
      );

      return () => {
        document.removeEventListener(
          'mousedown',
          manejarClickExterior,
        );

        document.removeEventListener(
          'keydown',
          manejarEscape,
        );
      };
    },
    [],
  );

  async function cargarNotificaciones() {
    setCargandoNotificaciones(
      true,
    );

    setErrorNotificaciones(
      '',
    );

    try {
      const [
        listado,
        conteo,
      ] =
        await Promise.all(
          [
            listarNotificaciones(
              1,
              20,
            ),

            obtenerConteoNoLeidas(),
          ],
        );

      setNotificaciones(
        listado.notificaciones,
      );

      setTotalNoLeidas(
        conteo.total,
      );
    } catch {
      setErrorNotificaciones(
        'No fue posible cargar las notificaciones.',
      );
    } finally {
      setCargandoNotificaciones(
        false,
      );
    }
  }

  async function alternarNotificaciones() {
    const abrir =
      !notificacionesAbiertas;

    setNotificacionesAbiertas(
      abrir,
    );

    setMenuUsuarioAbierto(
      false,
    );

    if (
      abrir
    ) {
      await cargarNotificaciones();
    }
  }

  async function abrirNotificacion(
    notificacion:
      Notificacion,
  ) {
    if (
      !notificacion.leida
    ) {
      try {
        await marcarNotificacionLeida(
          notificacion.id_notificacion,
        );

        setNotificaciones(
          (
            actuales,
          ) =>
            actuales.map(
              (
                item,
              ) =>
                item.id_notificacion ===
                notificacion.id_notificacion
                  ? {
                      ...item,

                      leida:
                        true,

                      fecha_leida:
                        new Date().toISOString(),
                    }
                  : item,
            ),
        );

        setTotalNoLeidas(
          (
            actual,
          ) =>
            Math.max(
              0,
              actual -
                1,
            ),
        );
      } catch {
        setErrorNotificaciones(
          'No fue posible marcar la notificación como leída.',
        );

        return;
      }
    }

    setNotificacionesAbiertas(
      false,
    );

    onAbrirNotificacion(
      notificacion,
    );
  }

  async function marcarTodas() {
    if (
      marcandoTodas ||
      totalNoLeidas ===
        0
    ) {
      return;
    }

    setMarcandoTodas(
      true,
    );

    setErrorNotificaciones(
      '',
    );

    try {
      await marcarTodasNotificacionesLeidas();

      const ahora =
        new Date().toISOString();

      setNotificaciones(
        (
          actuales,
        ) =>
          actuales.map(
            (
              item,
            ) => ({
              ...item,

              leida:
                true,

              fecha_leida:
                item.fecha_leida ??
                ahora,
            }),
          ),
      );

      setTotalNoLeidas(
        0,
      );
    } catch {
      setErrorNotificaciones(
        'No fue posible marcar todas las notificaciones como leídas.',
      );
    } finally {
      setMarcandoTodas(
        false,
      );
    }
  }

  function abrirPerfilDesdeMenu() {
    setMenuUsuarioAbierto(
      false,
    );

    onIrPerfil();
  }

  function cerrarSesionDesdeMenu() {
    setMenuUsuarioAbierto(
      false,
    );

    onCerrarSesion();
  }

  return (
    <div
      className={
        styles.app
      }
    >
      <header
        className={
          styles.topbar
        }
      >
        <div
          className={
            styles.brand
          }
        >
          <img
            className={
              styles.brandLogo
            }
            src={
              logoIngevit
            }
            alt="INGEVIT"
          />
        </div>

        <div
          className={
            styles.userArea
          }
        >
          <div
            className={
              styles.notificationWrapper
            }
            ref={
              notificacionesRef
            }
          >
            <button
              className={`${styles.notificationButton} ${
                notificacionesAbiertas
                  ? styles.notificationButtonActive
                  : ''
              }`}
              type="button"
              aria-label={
                totalNoLeidas >
                0
                  ? `Notificaciones, ${totalNoLeidas} sin leer`
                  : 'Notificaciones'
              }
              aria-expanded={
                notificacionesAbiertas
              }
              aria-haspopup="dialog"
              onClick={() => {
                void alternarNotificaciones();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                />

                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                />
              </svg>

              {totalNoLeidas >
                0 && (
                <span
                  className={
                    styles.notificationBadge
                  }
                >
                  {totalNoLeidas >
                  99
                    ? '99+'
                    : totalNoLeidas}
                </span>
              )}
            </button>

            {notificacionesAbiertas && (
              <section
                className={
                  styles.notificationsPanel
                }
                aria-label="Notificaciones"
              >
                <header
                  className={
                    styles.notificationsHeader
                  }
                >
                  <div>
                    <strong>
                      Notificaciones
                    </strong>

                    <span>
                      {totalNoLeidas >
                      0
                        ? `${totalNoLeidas} sin leer`
                        : 'Actividad reciente'}
                    </span>
                  </div>

                  {totalNoLeidas >
                    0 && (
                    <button
                      className={
                        styles.notificationsMarkAll
                      }
                      type="button"
                      disabled={
                        marcandoTodas
                      }
                      onClick={() => {
                        void marcarTodas();
                      }}
                    >
                      {marcandoTodas
                        ? 'Marcando...'
                        : 'Marcar todas como leídas'}
                    </button>
                  )}
                </header>

                {cargandoNotificaciones ? (
                  <div
                    className={
                      styles.notificationsEmpty
                    }
                  >
                    <span>
                      Cargando notificaciones...
                    </span>
                  </div>
                ) : errorNotificaciones ? (
                  <div
                    className={
                      styles.notificationsEmpty
                    }
                  >
                    <strong>
                      No se pudieron cargar
                    </strong>

                    <span>
                      {
                        errorNotificaciones
                      }
                    </span>

                    <button
                      className={
                        styles.notificationsRetry
                      }
                      type="button"
                      onClick={() => {
                        void cargarNotificaciones();
                      }}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : notificaciones.length ===
                  0 ? (
                  <div
                    className={
                      styles.notificationsEmpty
                    }
                  >
                    <div
                      className={
                        styles.notificationsEmptyIcon
                      }
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                        />

                        <path
                          d="M13.73 21a2 2 0 0 1-3.46 0"
                        />
                      </svg>
                    </div>

                    <strong>
                      Sin notificaciones
                    </strong>

                    <span>
                      Cuando tengas novedades, aparecerán aquí.
                    </span>
                  </div>
                ) : (
                  <div
                    className={
                      styles.notificationsList
                    }
                  >
                    {notificaciones.map(
                      (
                        notificacion,
                      ) => (
                        <button
                          key={
                            notificacion.id_notificacion
                          }
                          className={`${styles.notificationItem} ${
                            !notificacion.leida
                              ? styles.notificationItemUnread
                              : ''
                          }`}
                          type="button"
                          onClick={() => {
                            void abrirNotificacion(
                              notificacion,
                            );
                          }}
                        >
                          <span
                            className={
                              styles.notificationItemIcon
                            }
                            aria-hidden="true"
                          >
                            !
                          </span>

                          <span
                            className={
                              styles.notificationItemContent
                            }
                          >
                            <strong>
                              {
                                notificacion.titulo
                              }
                            </strong>

                            <span>
                              {
                                notificacion.mensaje
                              }
                            </span>

                            <small>
                              {formatearFechaNotificacion(
                                notificacion.fecha_creacion,
                              )}
                            </small>
                          </span>

                          {!notificacion.leida && (
                            <span
                              className={
                                styles.notificationUnreadDot
                              }
                              aria-label="Sin leer"
                            />
                          )}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          <div
            className={
              styles.userMenuWrapper
            }
            ref={
              menuUsuarioRef
            }
          >
            <button
              className={
                styles.userSummaryButton
              }
              type="button"
              aria-label="Abrir menú de usuario"
              aria-expanded={
                menuUsuarioAbierto
              }
              aria-haspopup="menu"
              onClick={() => {
                setMenuUsuarioAbierto(
                  (
                    valorActual,
                  ) =>
                    !valorActual,
                );

                setNotificacionesAbiertas(
                  false,
                );
              }}
            >
              <div
                className={
                  styles.avatar
                }
              >
                {avatarUrl ? (
                  <img
                    className={
                      styles.avatarImage
                    }
                    src={
                      avatarUrl
                    }
                    alt=""
                  />
                ) : (
                  iniciales
                )}
              </div>

              <div
                className={
                  styles.userInfo
                }
              >
                <strong>
                  {
                    nombreVisible
                  }
                </strong>

                <span>
                  {usuario.rol ===
                  'ADMINISTRADOR'
                    ? 'Administrador'
                    : 'Usuario'}
                </span>
              </div>

              <span
                className={`${styles.userMenuButton} ${
                  menuUsuarioAbierto
                    ? styles.userMenuButtonOpen
                    : ''
                }`}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            {menuUsuarioAbierto && (
              <div
                className={
                  styles.userDropdown
                }
                role="menu"
              >
                <div
                  className={
                    styles.userDropdownHeader
                  }
                >
                  <div
                    className={
                      styles.userDropdownAvatar
                    }
                  >
                    {avatarUrl ? (
                      <img
                        className={
                          styles.avatarImage
                        }
                        src={
                          avatarUrl
                        }
                        alt=""
                      />
                    ) : (
                      iniciales
                    )}
                  </div>

                  <div
                    className={
                      styles.userDropdownIdentity
                    }
                  >
                    <strong>
                      {
                        nombreVisible
                      }
                    </strong>

                    <span>
                      {
                        usuario.correo
                      }
                    </span>
                  </div>
                </div>

                <div
                  className={
                    styles.userDropdownDivider
                  }
                />

                <button
                  className={
                    styles.userDropdownItem
                  }
                  type="button"
                  role="menuitem"
                  onClick={
                    abrirPerfilDesdeMenu
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="4"
                    />

                    <path
                      d="M4 21a8 8 0 0 1 16 0"
                    />
                  </svg>

                  <span>
                    Mi perfil
                  </span>
                </button>

                <button
                  className={`${styles.userDropdownItem} ${styles.userDropdownLogout}`}
                  type="button"
                  role="menuitem"
                  onClick={
                    cerrarSesionDesdeMenu
                  }
                  disabled={
                    cerrandoSesion
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 17l5-5-5-5"
                    />

                    <path
                      d="M15 12H3"
                    />

                    <path
                      d="M14 4h6v16h-6"
                    />
                  </svg>

                  <span>
                    {cerrandoSesion
                      ? 'Cerrando...'
                      : 'Cerrar sesión'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside
        className={
          styles.sidebar
        }
      >
        <nav
          className={
            styles.navigation
          }
          aria-label="Navegación principal"
        >
          <button
            className={`${styles.navItem} ${
              seccionActiva ===
              'inicio'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={
              onIrInicio
            }
            aria-current={
              seccionActiva ===
              'inicio'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M3 11.5 12 4l9 7.5"
              />

              <path
                d="M5.5 10.5V20h13v-9.5"
              />

              <path
                d="M9.5 20v-6h5v6"
              />
            </svg>

            <span>
              Inicio
            </span>
          </button>

          <button
            className={`${styles.navItem} ${
              seccionActiva ===
              'proyectos'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={
              onIrProyectos
            }
            aria-current={
              seccionActiva ===
              'proyectos'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M3 7.5h6l2-2h10v14H3z"
              />

              <path
                d="M3 10h18"
              />
            </svg>

            <span>
              Proyectos
            </span>
          </button>

          <button
            className={`${styles.navItem} ${
              seccionActiva ===
              'perfil'
                ? styles.navItemActive
                : ''
            }`}
            type="button"
            onClick={
              onIrPerfil
            }
            aria-current={
              seccionActiva ===
              'perfil'
                ? 'page'
                : undefined
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="8"
                r="4"
              />

              <path
                d="M4 21a8 8 0 0 1 16 0"
              />
            </svg>

            <span>
              Mi Perfil
            </span>
          </button>
        </nav>

        <div
          className={
            styles.sidebarBottom
          }
        >
          <button
            className={
              styles.supportButton
            }
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
              />

              <path
                d="M9.5 9a2.5 2.5 0 1 1 4.2 1.82C12.8 11.55 12 12.2 12 14"
              />

              <path
                d="M12 18h.01"
              />
            </svg>

            <span>
              Soporte
            </span>
          </button>

          <button
            className={
              styles.logoutButton
            }
            type="button"
            onClick={
              onCerrarSesion
            }
            disabled={
              cerrandoSesion
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M10 17l5-5-5-5"
              />

              <path
                d="M15 12H3"
              />

              <path
                d="M14 4h6v16h-6"
              />
            </svg>

            <span>
              {cerrandoSesion
                ? 'Cerrando...'
                : 'Cerrar sesión'}
            </span>
          </button>
        </div>
      </aside>

      <main
        className={
          styles.content
        }
      >
        {children}
      </main>
    </div>
  );
}