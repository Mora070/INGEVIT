
import { useState, useRef, useCallback } from 'react';
import type { PointerEvent } from 'react';

import type {
  FotografiaProyecto,
} from '../../types/fotografia';

import styles from './PhotoComparison.module.css';

interface PhotoComparisonProps {
  fotografias: FotografiaProyecto[];
  onCerrar: () => void;
}

function formatearFecha(fecha: string): string {
  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(valor);
}

function calcularDias(
  fechaInicial: string,
  fechaFinal: string,
): number | null {
  const inicial = new Date(fechaInicial).getTime();
  const final = new Date(fechaFinal).getTime();

  if (
    !Number.isFinite(inicial) ||
    !Number.isFinite(final)
  ) {
    return null;
  }

  return Math.floor(
    Math.abs(final - inicial) / 86400000,
  );
}

export function PhotoComparison({
  fotografias,
  onCerrar,
}: PhotoComparisonProps) {
  const [posicion, setPosicion] = useState(50);

  const contenedorRef = useRef<HTMLDivElement>(null);

  const fotografiasOrdenadas = [...fotografias].sort(
    (a, b) =>
      new Date(a.fecha_subida).getTime() -
      new Date(b.fecha_subida).getTime(),
  );

  if (fotografiasOrdenadas.length !== 2) {
    return null;
  }

  const [antes, despues] = fotografiasOrdenadas;

  const diasTranscurridos = calcularDias(
    antes.fecha_subida,
    despues.fecha_subida,
  );

  const actualizarPosicion = useCallback(
    (clientX: number) => {
      const contenedor = contenedorRef.current;

      if (!contenedor) return;

      const rect = contenedor.getBoundingClientRect();

      const porcentaje =
        ((clientX - rect.left) / rect.width) * 100;

      setPosicion(
        Math.max(0, Math.min(100, porcentaje)),
      );
    },
    [],
  );

  const iniciarDeslizamiento = (
    evento: PointerEvent<HTMLDivElement>,
  ) => {
    evento.currentTarget.setPointerCapture(
      evento.pointerId,
    );

    actualizarPosicion(evento.clientX);
  };

  const moverDeslizador = (
    evento: PointerEvent<HTMLDivElement>,
  ) => {
    if (!evento.currentTarget.hasPointerCapture(
      evento.pointerId,
    )) {
      return;
    }

    actualizarPosicion(evento.clientX);
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-comparacion"
      >
        <header className={styles.header}>
          <div>
            <h2 id="titulo-comparacion">
              Comparativa de fotografías
            </h2>
            <p>
              Desliza la línea para comparar el avance
              visual del proyecto.
            </p>
          </div>

          <button
            type="button"
            className={styles.cerrar}
            onClick={onCerrar}
            aria-label="Cerrar comparación"
          >
            ×
          </button>
        </header>

        <div
          ref={contenedorRef}
          className={styles.comparador}
          onPointerDown={iniciarDeslizamiento}
          onPointerMove={moverDeslizador}
        >
          <img
            className={styles.imagen}
            src={despues.url}
            alt={`Fotografía reciente: ${despues.titulo}`}
            draggable={false}
          />

          <img
            className={styles.imagenAntes}
            src={antes.url}
            alt={`Fotografía inicial: ${antes.titulo}`}
            draggable={false}
            style={{
              clipPath: `inset(0 ${100 - posicion}% 0 0)`,
            }}
          />

          <div className={styles.etiquetaAntes}>
            ANTES
          </div>

          <div className={styles.etiquetaDespues}>
            DESPUÉS
          </div>

          <div
            className={styles.linea}
            style={{ left: `${posicion}%` }}
          >
            <div className={styles.control}>
              ‹ ›
            </div>
          </div>
        </div>

        <div className={styles.informacion}>
          <div className={styles.fotografiaInfo}>
            <span className={styles.indicador}>
              01
            </span>

            <div>
              <strong>{antes.titulo}</strong>
              <p>{formatearFecha(antes.fecha_subida)}</p>
              <small>Fotografía inicial</small>
            </div>
          </div>

          <div className={styles.tiempo}>
            <strong>
              {diasTranscurridos === null
                ? 'Sin fecha'
                : `${diasTranscurridos} días`}
            </strong>
            <span>entre fotografías</span>
          </div>

          <div className={styles.fotografiaInfo}>
            <span className={styles.indicador}>
              02
            </span>

            <div>
              <strong>{despues.titulo}</strong>
              <p>{formatearFecha(despues.fecha_subida)}</p>
              <small>Fotografía reciente</small>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <span>
            Comparación visual del avance de obra
          </span>

          <button
            type="button"
            onClick={onCerrar}
          >
            Volver a fotografías
          </button>
        </footer>
      </section>
    </div>
  );
}
