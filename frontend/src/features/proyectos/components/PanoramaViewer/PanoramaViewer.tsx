import {
  useEffect,
  useRef,
} from 'react';

import 'pannellum/build/pannellum.js';
import 'pannellum/build/pannellum.css';

import styles from './PanoramaViewer.module.css';

interface PanoramaViewerProps {
  url: string;

  titulo: string;

  onCerrar: () => void;
}

interface ConfiguracionPannellum {
  type: 'equirectangular';

  panorama: string;

  autoLoad?: boolean;

  showControls?: boolean;

  showFullscreenCtrl?: boolean;

  showZoomCtrl?: boolean;

  mouseZoom?: boolean;

  draggable?: boolean;

  keyboardZoom?: boolean;

  compass?: boolean;

  hfov?: number;

  minHfov?: number;

  maxHfov?: number;

  pitch?: number;

  yaw?: number;

  title?: string;
}

interface VisorPannellum {
  destroy: () => void;
}

interface PannellumGlobal {
  viewer: (
    contenedor:
      HTMLElement | string,
    configuracion:
      ConfiguracionPannellum,
  ) => VisorPannellum;
}

export function PanoramaViewer({
  url,
  titulo,
  onCerrar,
}: PanoramaViewerProps) {
  const contenedorRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    if (
      !contenedorRef.current
    ) {
      return;
    }

    const ventanaConPannellum =
      window as typeof window & {
        pannellum?:
          PannellumGlobal;
      };

    const pannellumGlobal =
      ventanaConPannellum.pannellum;

    if (
      !pannellumGlobal
    ) {
      console.error(
        'Pannellum no pudo cargarse.',
      );

      return;
    }

    const visor =
      pannellumGlobal.viewer(
        contenedorRef.current,
        {
          type:
            'equirectangular',

          panorama:
            url,

          autoLoad:
            true,

          showControls:
            true,

          showFullscreenCtrl:
            true,

          showZoomCtrl:
            true,

          mouseZoom:
            true,

          draggable:
            true,

          keyboardZoom:
            true,

          compass:
            false,

          hfov:
            100,

          minHfov:
            40,

          maxHfov:
            120,

          pitch:
            0,

          yaw:
            0,

          title:
            titulo,
        },
      );

    return () => {
      visor.destroy();
    };
  }, [
    url,
    titulo,
  ]);

  useEffect(() => {
    function manejarEscape(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        'Escape'
      ) {
        onCerrar();
      }
    }

    window.addEventListener(
      'keydown',
      manejarEscape,
    );

    const overflowAnterior =
      document.body.style
        .overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      window.removeEventListener(
        'keydown',
        manejarEscape,
      );

      document.body.style.overflow =
        overflowAnterior;
    };
  }, [
    onCerrar,
  ]);

  function cerrarDesdeFondo(
    event:
      React.MouseEvent<
        HTMLDivElement
      >,
  ) {
    if (
      event.target ===
      event.currentTarget
    ) {
      onCerrar();
    }
  }

  return (
    <div
      className={
        styles.overlay
      }
      onMouseDown={
        cerrarDesdeFondo
      }
      role="presentation"
    >
      <section
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="panorama-viewer-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <span
              className={
                styles.badge
              }
            >
              360°
            </span>

            <h2
              id="panorama-viewer-title"
            >
              {titulo}
            </h2>
          </div>

          <button
            className={
              styles.closeButton
            }
            type="button"
            onClick={
              onCerrar
            }
            aria-label="Cerrar panorámica"
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
            styles.viewer
          }
          ref={
            contenedorRef
          }
        />

        <footer
          className={
            styles.footer
          }
        >
          <span>
            Arrastra para mirar alrededor
          </span>

          <span>
            Usa la rueda del mouse para acercar o alejar
          </span>
        </footer>
      </section>
    </div>
  );
}