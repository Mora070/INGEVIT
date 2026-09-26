import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  agregarColaboradorProyecto,
  listarParticipantesProyecto,
  retirarColaboradorProyecto,
} from '../../api/proyectos.api';

import {
  listarUsuariosDisponibles,
} from '../../api/usuarios-colaboradores.api';

import type {
  ParticipanteProyecto,
} from '../../types/proyecto';

import type {
  UsuarioDisponibleColaborador,
} from '../../types/usuario-colaborador';

import {
  ApiError,
} from '../../../../shared/api/http';

import styles from './CollaboratorsModal.module.css';

interface CollaboratorsModalProps {
  idProyecto: string;

  onCerrar: () => void;

  onEquipoActualizado?: () => void;
}

function obtenerNombreCompleto(
  nombre: string | null,
  apellidos: string | null,
): string {
  const partes = [
    nombre?.trim(),
    apellidos?.trim(),
  ].filter(
    (valor): valor is string =>
      Boolean(valor),
  );

  if (partes.length === 0) {
    return 'Usuario';
  }

  return partes.join(' ');
}

function obtenerIniciales(
  nombre: string | null,
  apellidos: string | null,
): string {
  const primera =
    nombre?.trim().charAt(0) ??
    '';

  const segunda =
    apellidos?.trim().charAt(0) ??
    '';

  const iniciales =
    `${primera}${segunda}`
      .trim()
      .toUpperCase();

  return iniciales || 'U';
}

export function CollaboratorsModal({
  idProyecto,
  onCerrar,
  onEquipoActualizado,
}: CollaboratorsModalProps) {
  const [
    participantes,
    setParticipantes,
  ] = useState<
    ParticipanteProyecto[]
  >([]);

  const [
    usuarios,
    setUsuarios,
  ] = useState<
    UsuarioDisponibleColaborador[]
  >([]);

  const [
    busqueda,
    setBusqueda,
  ] = useState('');

  const [
    busquedaAplicada,
    setBusquedaAplicada,
  ] = useState('');

  const [
    cargandoParticipantes,
    setCargandoParticipantes,
  ] = useState(true);

  const [
    cargandoUsuarios,
    setCargandoUsuarios,
  ] = useState(true);

  const [
    usuarioProcesando,
    setUsuarioProcesando,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    const temporizador =
      window.setTimeout(() => {
        setBusquedaAplicada(
          busqueda.trim(),
        );
      }, 250);

    return () => {
      window.clearTimeout(
        temporizador,
      );
    };
  }, [
    busqueda,
  ]);

  async function cargarParticipantes() {
    setCargandoParticipantes(
      true,
    );

    try {
      const respuesta =
        await listarParticipantesProyecto(
          idProyecto,
        );

      setParticipantes(
        respuesta,
      );
    } catch (errorObtenido) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible cargar los colaboradores del proyecto.',
        );
      }
    } finally {
      setCargandoParticipantes(
        false,
      );
    }
  }

  useEffect(() => {
    void cargarParticipantes();
  }, [
    idProyecto,
  ]);

  useEffect(() => {
    let activa = true;

    async function cargarUsuarios() {
      setCargandoUsuarios(
        true,
      );

      setError(
        null,
      );

      try {
        const respuesta =
          await listarUsuariosDisponibles({
            correo:
              busquedaAplicada,
            pagina: 1,
            limite: 50,
          });

        if (!activa) {
          return;
        }

        setUsuarios(
          respuesta.usuarios,
        );
      } catch (errorObtenido) {
        if (!activa) {
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
            'No fue posible cargar los usuarios registrados.',
          );
        }

        setUsuarios([]);
      } finally {
        if (activa) {
          setCargandoUsuarios(
            false,
          );
        }
      }
    }

    void cargarUsuarios();

    return () => {
      activa = false;
    };
  }, [
    busquedaAplicada,
  ]);

  useEffect(() => {
    function cerrarConEscape(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        onCerrar();
      }
    }

    document.addEventListener(
      'keydown',
      cerrarConEscape,
    );

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.removeEventListener(
        'keydown',
        cerrarConEscape,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    onCerrar,
  ]);

  const colaboradores =
    useMemo(
      () =>
        participantes.filter(
          (participante) =>
            participante.participacion ===
            'COLABORADOR',
        ),
      [
        participantes,
      ],
    );

  const propietario =
    useMemo(
      () =>
        participantes.find(
          (participante) =>
            participante.participacion ===
            'PROPIETARIO',
        ) ?? null,
      [
        participantes,
      ],
    );

  const idsParticipantes =
    useMemo(
      () =>
        new Set(
          participantes.map(
            (participante) =>
              participante.id_usuario,
          ),
        ),
      [
        participantes,
      ],
    );

  const usuariosDisponibles =
    useMemo(
      () =>
        usuarios.filter(
          (usuario) =>
            !idsParticipantes.has(
              usuario.id_usuario,
            ),
        ),
      [
        idsParticipantes,
        usuarios,
      ],
    );

  async function agregarColaborador(
    usuario:
      UsuarioDisponibleColaborador,
  ) {
    if (
      usuarioProcesando !==
      null
    ) {
      return;
    }

    setUsuarioProcesando(
      usuario.id_usuario,
    );

    setError(
      null,
    );

    try {
      await agregarColaboradorProyecto(
        idProyecto,
        usuario.id_usuario,
      );

      await cargarParticipantes();

      setUsuarios(
        (usuariosActuales) =>
          usuariosActuales.filter(
            (usuarioActual) =>
              usuarioActual.id_usuario !==
              usuario.id_usuario,
          ),
      );

      onEquipoActualizado?.();
    } catch (errorObtenido) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible agregar el colaborador.',
        );
      }
    } finally {
      setUsuarioProcesando(
        null,
      );
    }
  }

  async function retirarColaborador(
    participante:
      ParticipanteProyecto,
  ) {
    if (
      participante.participacion !==
        'COLABORADOR' ||
      usuarioProcesando !==
        null
    ) {
      return;
    }

    const nombre =
      obtenerNombreCompleto(
        participante.nombre,
        participante.apellidos,
      );

    const confirmado =
      window.confirm(
        `¿Deseas retirar a ${nombre} del proyecto?`,
      );

    if (!confirmado) {
      return;
    }

    setUsuarioProcesando(
      participante.id_usuario,
    );

    setError(
      null,
    );

    try {
      await retirarColaboradorProyecto(
        idProyecto,
        participante.id_usuario,
      );

      await cargarParticipantes();

      const respuesta =
        await listarUsuariosDisponibles({
          correo:
            busquedaAplicada,
          pagina: 1,
          limite: 50,
        });

      setUsuarios(
        respuesta.usuarios,
      );

      onEquipoActualizado?.();
    } catch (errorObtenido) {
      if (
        errorObtenido instanceof
        ApiError
      ) {
        setError(
          errorObtenido.message,
        );
      } else {
        setError(
          'No fue posible retirar el colaborador.',
        );
      }
    } finally {
      setUsuarioProcesando(
        null,
      );
    }
  }

  return (
    <div
      className={
        styles.backdrop
      }
      role="presentation"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onCerrar();
        }
      }}
    >
      <section
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="collaborators-modal-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              Equipo del proyecto
            </span>

            <h2
              id="collaborators-modal-title"
            >
              Agregar colaborador
            </h2>

            <p>
              Busca personas registradas
              en INGEVIT y administra
              quienes participan en este
              proyecto.
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

        {error && (
          <div
            className={
              styles.error
            }
            role="alert"
          >
            {error}
          </div>
        )}

        <div
          className={
            styles.content
          }
        >
          <section
            className={
              styles.currentTeam
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <div>
                <h3>
                  Equipo actual
                </h3>

                <span>
                  {colaboradores.length}{' '}
                  {colaboradores.length ===
                  1
                    ? 'colaborador'
                    : 'colaboradores'}
                </span>
              </div>
            </div>

            {cargandoParticipantes ? (
              <div
                className={
                  styles.loading
                }
              >
                Cargando equipo...
              </div>
            ) : (
              <div
                className={
                  styles.teamList
                }
              >
                {propietario && (
                  <div
                    className={
                      styles.person
                    }
                  >
                    <div
                      className={
                        styles.avatar
                      }
                    >
                      {propietario.foto_perfil_url ? (
                        <img
                          src={
                            propietario.foto_perfil_url
                          }
                          alt=""
                        />
                      ) : (
                        obtenerIniciales(
                          propietario.nombre,
                          propietario.apellidos,
                        )
                      )}
                    </div>

                    <div
                      className={
                        styles.personInfo
                      }
                    >
                      <strong>
                        {obtenerNombreCompleto(
                          propietario.nombre,
                          propietario.apellidos,
                        )}
                      </strong>

                      <span>
                        Propietario
                      </span>
                    </div>

                    <span
                      className={
                        styles.ownerBadge
                      }
                    >
                      Propietario
                    </span>
                  </div>
                )}

                {colaboradores.map(
                  (participante) => (
                    <div
                      key={
                        participante.id_usuario
                      }
                      className={
                        styles.person
                      }
                    >
                      <div
                        className={
                          styles.avatar
                        }
                      >
                        {participante.foto_perfil_url ? (
                          <img
                            src={
                              participante.foto_perfil_url
                            }
                            alt=""
                          />
                        ) : (
                          obtenerIniciales(
                            participante.nombre,
                            participante.apellidos,
                          )
                        )}
                      </div>

                      <div
                        className={
                          styles.personInfo
                        }
                      >
                        <strong>
                          {obtenerNombreCompleto(
                            participante.nombre,
                            participante.apellidos,
                          )}
                        </strong>

                        <span>
                          Colaborador
                        </span>
                      </div>

                      <button
                        className={
                          styles.removeButton
                        }
                        type="button"
                        disabled={
                          usuarioProcesando !==
                          null
                        }
                        onClick={() => {
                          void retirarColaborador(
                            participante,
                          );
                        }}
                      >
                        {usuarioProcesando ===
                        participante.id_usuario
                          ? 'Retirando...'
                          : 'Retirar'}
                      </button>
                    </div>
                  ),
                )}

                {colaboradores.length ===
                  0 && (
                  <div
                    className={
                      styles.emptyTeam
                    }
                  >
                    Este proyecto todavía
                    no tiene colaboradores.
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            className={
              styles.availableUsers
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <div>
                <h3>
                  Personas registradas
                </h3>

                <span>
                  Selecciona un usuario
                  para agregarlo.
                </span>
              </div>
            </div>

            <label
              className={
                styles.searchBox
              }
            >
              <span
                className={
                  styles.srOnly
                }
              >
                Buscar por correo
              </span>

              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                />

                <path d="m20 20-4-4" />
              </svg>

              <input
                type="search"
                value={
                  busqueda
                }
                placeholder="Buscar por correo..."
                onChange={(
                  event,
                ) => {
                  setBusqueda(
                    event.target.value,
                  );
                }}
              />
            </label>

            {cargandoUsuarios ? (
              <div
                className={
                  styles.loading
                }
              >
                Buscando usuarios...
              </div>
            ) : (
              <div
                className={
                  styles.usersList
                }
              >
                {usuariosDisponibles.map(
                  (usuario) => (
                    <div
                      key={
                        usuario.id_usuario
                      }
                      className={
                        styles.person
                      }
                    >
                      <div
                        className={
                          styles.avatar
                        }
                      >
                        {usuario.foto_perfil_url ? (
                          <img
                            src={
                              usuario.foto_perfil_url
                            }
                            alt=""
                          />
                        ) : (
                          obtenerIniciales(
                            usuario.nombre,
                            usuario.apellidos,
                          )
                        )}
                      </div>

                      <div
                        className={
                          styles.personInfo
                        }
                      >
                        <strong>
                          {obtenerNombreCompleto(
                            usuario.nombre,
                            usuario.apellidos,
                          )}
                        </strong>

                        <span>
                          {
                            usuario.correo
                          }
                        </span>
                      </div>

                      <button
                        className={
                          styles.addButton
                        }
                        type="button"
                        disabled={
                          usuarioProcesando !==
                          null
                        }
                        onClick={() => {
                          void agregarColaborador(
                            usuario,
                          );
                        }}
                      >
                        {usuarioProcesando ===
                        usuario.id_usuario
                          ? 'Agregando...'
                          : 'Agregar'}
                      </button>
                    </div>
                  ),
                )}

                {usuariosDisponibles.length ===
                  0 && (
                  <div
                    className={
                      styles.emptyUsers
                    }
                  >
                    {busqueda.trim()
                      ? 'No encontramos usuarios con ese correo.'
                      : 'No hay usuarios disponibles para agregar.'}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}