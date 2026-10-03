import {
  useEffect,
  useRef,
} from 'react';

import styles from './ResourceContextMenu.module.css';

interface ResourceContextMenuProps {
  x: number;
  y: number;

  onCerrar: () => void;

  onAbrir: () => void;

  onMover: () => void;

  onQuitar: () => void;
}

export function ResourceContextMenu({
  x,
  y,
  onCerrar,
  onAbrir,
  onMover,
  onQuitar,
}: ResourceContextMenuProps) {
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
  ]);

  function ejecutar(
    accion: () => void,
  ) {
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
      aria-label="Opciones del recurso"
      onContextMenu={(
        event,
      ) => {
        event.preventDefault();
      }}
    >
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
            onQuitar,
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
          Quitar de carpeta
        </span>
      </button>
    </div>
  );
}