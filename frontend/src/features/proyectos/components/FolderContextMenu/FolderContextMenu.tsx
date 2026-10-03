import {
  useEffect,
  useRef,
} from 'react';

import styles from './FolderContextMenu.module.css';

export type FolderContextMenuMode =
  | 'EMPTY'
  | 'FOLDER';

interface FolderContextMenuProps {
  x: number;
  y: number;

  mode: FolderContextMenuMode;

  onCerrar: () => void;

  onNuevaCarpeta: () => void;

  onAgregarRecursos?: () => void;

  onAbrir?: () => void;

  onNuevaSubcarpeta?: () => void;

  onRenombrar?: () => void;

  onMover?: () => void;

  onEliminar?: () => void;
}

export function FolderContextMenu({
  x,
  y,
  mode,
  onCerrar,
  onNuevaCarpeta,
  onAgregarRecursos,
  onAbrir,
  onNuevaSubcarpeta,
  onRenombrar,
  onMover,
  onEliminar,
}: FolderContextMenuProps) {
  const menuRef =
    useRef<HTMLDivElement>(
      null,
    );

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

    function cerrarAlHacerClick(
      event: MouseEvent,
    ) {
      const menu =
        menuRef.current;

      if (
        !menu ||
        menu.contains(
          event.target as Node,
        )
      ) {
        return;
      }

      onCerrar();
    }

    function cerrarConScroll() {
      onCerrar();
    }

    window.addEventListener(
      'keydown',
      cerrarConEscape,
    );

    document.addEventListener(
      'mousedown',
      cerrarAlHacerClick,
    );

    window.addEventListener(
      'scroll',
      cerrarConScroll,
      true,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        cerrarConEscape,
      );

      document.removeEventListener(
        'mousedown',
        cerrarAlHacerClick,
      );

      window.removeEventListener(
        'scroll',
        cerrarConScroll,
        true,
      );
    };
  }, [
    onCerrar,
  ]);

  useEffect(() => {
    const menu =
      menuRef.current;

    if (
      !menu
    ) {
      return;
    }

    const rect =
      menu.getBoundingClientRect();

    const margen =
      10;

    let izquierda =
      x;

    let arriba =
      y;

    if (
      izquierda +
      rect.width +
      margen >
      window.innerWidth
    ) {
      izquierda =
        window.innerWidth -
        rect.width -
        margen;
    }

    if (
      arriba +
      rect.height +
      margen >
      window.innerHeight
    ) {
      arriba =
        window.innerHeight -
        rect.height -
        margen;
    }

    izquierda =
      Math.max(
        margen,
        izquierda,
      );

    arriba =
      Math.max(
        margen,
        arriba,
      );

    menu.style.left =
      `${izquierda}px`;

    menu.style.top =
      `${arriba}px`;
  }, [
    x,
    y,
    mode,
  ]);

  function ejecutar(
    accion:
      | (() => void)
      | undefined,
  ) {
    if (
      !accion
    ) {
      return;
    }

    accion();

    onCerrar();
  }

  return (
    <div
      ref={
        menuRef
      }
      className={
        styles.menu
      }
      style={{
        left: x,
        top: y,
      }}
      role="menu"
      aria-label={
        mode ===
          'FOLDER'
          ? 'Opciones de carpeta'
          : 'Opciones'
      }
      onContextMenu={(
        event,
      ) => {
        event.preventDefault();
      }}
    >
      {mode ===
        'EMPTY' ? (
        <>
          <button
            className={
              styles.item
            }
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onNuevaCarpeta,
              );
            }}
          >
            <span
              className={
                styles.icon
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
            </span>

            <span>
              Nueva carpeta
            </span>
          </button>

          {onAgregarRecursos && (
            <button
              className={
                styles.item
              }
              type="button"
              role="menuitem"
              onClick={() => {
                ejecutar(
                  onAgregarRecursos,
                );
              }}
            >
              <span
                className={
                  styles.icon
                }
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                >
                  <path d="M4 5h6l2 2h8v12H4V5Z" />

                  <path d="M12 10v5" />

                  <path d="M9.5 12.5h5" />
                </svg>
              </span>

              <span>
                Agregar recursos
              </span>
            </button>
          )}
        </>
      ) : (
        <>
          <button
            className={
              styles.item
            }
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onAbrir,
              );
            }}
          >
            <span
              className={
                styles.icon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <path d="M4 12h15" />

                <path d="m14 7 5 5-5 5" />
              </svg>
            </span>

            <span>
              Abrir
            </span>
          </button>

          <button
            className={
              styles.item
            }
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onNuevaSubcarpeta,
              );
            }}
          >
            <span
              className={
                styles.icon
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
            </span>

            <span>
              Nueva subcarpeta
            </span>
          </button>

          <div
            className={
              styles.separator
            }
            role="separator"
          />

          <button
            className={
              styles.item
            }
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onRenombrar,
              );
            }}
          >
            <span
              className={
                styles.icon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <path d="M4 20h4l10-10-4-4L4 16v4Z" />

                <path d="m12.5 7.5 4 4" />
              </svg>
            </span>

            <span>
              Renombrar
            </span>
          </button>

          <button
            className={
              styles.item
            }
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onMover,
              );
            }}
          >
            <span
              className={
                styles.icon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <path d="M4 7h6l2 2h8v9H4V7Z" />

                <path d="m13 13 2-2 2 2" />

                <path d="M15 11v5" />
              </svg>
            </span>

            <span>
              Mover a...
            </span>
          </button>

          <div
            className={
              styles.separator
            }
            role="separator"
          />

          <button
            className={`${styles.item} ${styles.danger}`}
            type="button"
            role="menuitem"
            onClick={() => {
              ejecutar(
                onEliminar,
              );
            }}
          >
            <span
              className={
                styles.icon
              }
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
              >
                <path d="M4 7h16" />

                <path d="M9 7V4h6v3" />

                <path d="m7 7 1 13h8l1-13" />

                <path d="M10 11v5" />

                <path d="M14 11v5" />
              </svg>
            </span>

            <span>
              Eliminar
            </span>
          </button>
        </>
      )}
    </div>
  );
}