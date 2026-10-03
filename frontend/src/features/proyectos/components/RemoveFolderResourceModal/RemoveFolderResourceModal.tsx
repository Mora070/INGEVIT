import { useEffect } from 'react';

import styles from './RemoveFolderResourceModal.module.css';

interface RemoveFolderResourceModalProps {
  nombreRecurso: string;
  quitando: boolean;
  error: string | null;
  onCerrar: () => void;
  onConfirmar: () => void;
}

export function RemoveFolderResourceModal({
  nombreRecurso,
  quitando,
  error,
  onCerrar,
  onConfirmar,
}: RemoveFolderResourceModalProps) {
  useEffect(() => {
    function manejarTeclado(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape' &&
        !quitando
      ) {
        onCerrar();
      }
    }

    window.addEventListener(
      'keydown',
      manejarTeclado,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        manejarTeclado,
      );
    };
  }, [
    onCerrar,
    quitando,
  ]);

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !quitando
        ) {
          onCerrar();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-folder-resource-title"
      >
        <div
          className={
            styles.iconContainer
          }
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
          >
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M7 7l1 13h8l1-13" />
            <path d="M10 11v5" />
            <path d="M14 11v5" />
          </svg>
        </div>

        <div
          className={styles.content}
        >
          <h2
            id="remove-folder-resource-title"
            className={styles.title}
          >
            Quitar de la carpeta
          </h2>

          <p
            className={
              styles.description
            }
          >
            ¿Quieres quitar{' '}
            <strong>
              {nombreRecurso}
            </strong>{' '}
            de esta carpeta?
          </p>

          <div
            className={styles.notice}
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
              <path d="M12 10v6" />
              <path d="M12 7h.01" />
            </svg>

            <p>
              El archivo original
              seguirá disponible en
              el proyecto y no será
              eliminado.
            </p>
          </div>

          {error && (
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

        <div
          className={styles.actions}
        >
          <button
            type="button"
            className={
              styles.cancelButton
            }
            onClick={onCerrar}
            disabled={quitando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className={
              styles.removeButton
            }
            onClick={onConfirmar}
            disabled={quitando}
          >
            {quitando
              ? 'Quitando...'
              : 'Quitar de carpeta'}
          </button>
        </div>
      </section>
    </div>
  );
}