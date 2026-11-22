import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  X,
} from "lucide-react";

import type { Project } from "../../types";

interface ProjectModalProps {
  project: Project;
  onClose: () => void;
}

export default function ProjectModal({
  project,
  onClose,
}: ProjectModalProps) {
  const [activeImage, setActiveImage] = useState(0);

  /* =========================================================
     IMÁGENES DEL PROYECTO
  ========================================================= */

  const images =
    project.images && project.images.length > 0
      ? project.images
      : [project.image];

  /* =========================================================
     REINICIAR GALERÍA AL CAMBIAR DE PROYECTO
  ========================================================= */

  useEffect(() => {
    setActiveImage(0);
  }, [project]);

  /* =========================================================
     NAVEGACIÓN
  ========================================================= */

  const previousImage = () => {
    setActiveImage((current) =>
      current === 0 ? images.length - 1 : current - 1,
    );
  };

  const nextImage = () => {
    setActiveImage((current) =>
      current === images.length - 1 ? 0 : current + 1,
    );
  };

  /* =========================================================
     TECLADO + BLOQUEO DEL SCROLL
  ========================================================= */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (e.key === "ArrowLeft" && images.length > 1) {
        setActiveImage((current) =>
          current === 0 ? images.length - 1 : current - 1,
        );
      }

      if (e.key === "ArrowRight" && images.length > 1) {
        setActiveImage((current) =>
          current === images.length - 1 ? 0 : current + 1,
        );
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        bg-paper/85
        p-4
        backdrop-blur-sm
      "
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          max-h-[92vh]
          w-full
          max-w-5xl
          overflow-y-auto
          project-dialog topographic-surface
          shadow-2xl
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
      >
        {/* =====================================================
            GALERÍA PRINCIPAL
        ===================================================== */}

        <div className="relative h-64 overflow-hidden bg-surface sm:h-80 lg:h-[460px]">
          <img
            src={images[activeImage]}
            alt={`${project.title} - imagen ${activeImage + 1}`}
            className="
              h-full
              w-full
              object-cover
              transition-opacity
              duration-300
            "
          />

          {/* Overlay */}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper/95 via-transparent to-paper/20" />

          {/* =================================================
              CERRAR
          ================================================= */}

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar proyecto"
            className="
              absolute
              right-5
              top-5
              z-30
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-full
              border
              border-line-light
              bg-paper/95
              text-ink
              backdrop-blur-md
              transition-all
              duration-300

              hover:border-white
              hover:bg-paper/95
            "
          >
            <X
              size={20}
              strokeWidth={1.6}
            />
          </button>

          {/* =================================================
              FLECHA IZQUIERDA
          ================================================= */}

          {images.length > 1 && (
            <button
              type="button"
              onClick={previousImage}
              aria-label="Imagen anterior"
              className="
                absolute
                left-4
                top-1/2
                z-30
                flex
                h-11
                w-11
                -translate-y-1/2
                items-center
                justify-center
                rounded-full
                border
                border-line-light
                bg-paper/95
                text-ink
                backdrop-blur-md
                transition-all
                duration-300

                hover:border-white
                hover:bg-paper/95

                sm:left-6
                sm:h-12
                sm:w-12
              "
            >
              <ArrowLeft
                size={19}
                strokeWidth={1.6}
              />
            </button>
          )}

          {/* =================================================
              FLECHA DERECHA
          ================================================= */}

          {images.length > 1 && (
            <button
              type="button"
              onClick={nextImage}
              aria-label="Imagen siguiente"
              className="
                absolute
                right-4
                top-1/2
                z-30
                flex
                h-11
                w-11
                -translate-y-1/2
                items-center
                justify-center
                rounded-full
                border
                border-line-light
                bg-paper/95
                text-ink
                backdrop-blur-md
                transition-all
                duration-300

                hover:border-white
                hover:bg-paper/95

                sm:right-6
                sm:h-12
                sm:w-12
              "
            >
              <ArrowRight
                size={19}
                strokeWidth={1.6}
              />
            </button>
          )}

          {/* =================================================
              CATEGORÍA
          ================================================= */}

          <div className="absolute bottom-6 left-6 z-20 bg-paper/95 px-3 py-2 sm:left-8">
            <div className="flex items-center gap-3">
              <span className="h-px w-6 bg-accent" />

              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-warm">
                {project.category}
              </span>
            </div>
          </div>

          {/* =================================================
              CONTADOR
          ================================================= */}

          {images.length > 1 && (
            <div
              className="
                absolute
                bottom-5
                right-5
                z-20
                rounded-full
                border
                border-line-light
                bg-paper/95
                px-4
                py-2
                backdrop-blur-md

                sm:bottom-6
                sm:right-8
              "
            >
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-warm">
                {String(activeImage + 1).padStart(2, "0")}
                {" / "}
                {String(images.length).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>

        {/* =====================================================
            INFORMACIÓN DEL PROYECTO
        ===================================================== */}

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.45fr]">
            {/* INFORMACIÓN PRINCIPAL */}

            <div>
              <h2
                id="project-modal-title"
                className="max-w-2xl text-3xl text-ink sm:text-4xl"
              >
                {project.title}
              </h2>

              <div className="mt-4 flex items-center gap-2 text-sm text-muted-warm">
                <MapPin
                  size={16}
                  strokeWidth={1.6}
                  className="text-accent"
                />

                <span>{project.location}</span>
              </div>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-warm sm:text-[15px]">
                {project.description}
              </p>
            </div>

            {/* =================================================
                FICHA TÉCNICA
            ================================================= */}

            <div className="border-t border-line-light pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                Información del proyecto
              </p>

              {/* Alcance */}

              <div className="mt-5">
                <span className="block text-xs text-muted">
                  Alcance
                </span>

                <span className="mt-1 block text-sm font-medium leading-6 text-ink">
                  {project.detail}
                </span>
              </div>

              {/* Ubicación */}

              <div className="mt-5">
                <span className="block text-xs text-muted">
                  Ubicación
                </span>

                <span className="mt-1 block text-sm font-medium text-ink">
                  {project.location}
                </span>
              </div>

              {/* Área */}

              <div className="mt-5">
                <span className="block text-xs text-muted">
                  Área
                </span>

                <span className="mt-1 block text-sm font-medium text-ink">
                  {project.category}
                </span>
              </div>
            </div>
          </div>

          {/* =================================================
              LÍNEA INFERIOR
          ================================================= */}

          <div className="mt-8 border-t border-line-light pt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              INGEVIT · Ingeniería · Vías · Topografía
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}