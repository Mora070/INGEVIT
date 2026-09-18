import {
  useEffect,
  useRef,
} from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import type {
  Proyecto,
} from '../../types/proyecto';

import styles from './ProjectsMap.module.css';

interface ProjectsMapProps {
  proyectos: Proyecto[];
}

const CENTRO_INICIAL: [
  number,
  number,
] = [
  -74.2973,
  4.5709,
];

export function ProjectsMap({
  proyectos,
}: ProjectsMapProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const map =
    useRef<mapboxgl.Map | null>(null);

  const marcadores =
    useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    const accessToken =
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN;

    if (
      !mapContainer.current ||
      map.current
    ) {
      return;
    }

    if (!accessToken) {
      return;
    }

    mapboxgl.accessToken =
      accessToken;

    map.current =
      new mapboxgl.Map({
        container:
          mapContainer.current,

        style:
          'mapbox://styles/mapbox/streets-v12',

        center:
          CENTRO_INICIAL,

        zoom: 4.5,

        attributionControl: true,
      });

    map.current.addControl(
      new mapboxgl.NavigationControl(),
      'top-right',
    );

    return () => {
      map.current?.remove();

      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) {
      return;
    }

    marcadores.current.forEach(
      (marcador) => {
        marcador.remove();
      },
    );

    marcadores.current = [];

    const proyectosConCoordenadas =
      proyectos.filter(
        (proyecto) =>
          proyecto.latitud !== null &&
          proyecto.longitud !== null,
      );

    if (
      proyectosConCoordenadas.length ===
      0
    ) {
      return;
    }

    const bounds =
      new mapboxgl.LngLatBounds();

    proyectosConCoordenadas.forEach(
      (proyecto) => {
        if (
          proyecto.latitud === null ||
          proyecto.longitud === null
        ) {
          return;
        }

        const popup =
          new mapboxgl.Popup({
            offset: 18,
          }).setHTML(`
            <div>
              <strong>${proyecto.nombre}</strong>
              <p>${proyecto.direccion}</p>
            </div>
          `);

        const marcador =
          new mapboxgl.Marker({
            color: '#ea751a',
          })
            .setLngLat([
              proyecto.longitud,
              proyecto.latitud,
            ])
            .setPopup(popup)
            .addTo(map.current!);

        marcadores.current.push(
          marcador,
        );

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
        proyectosConCoordenadas[0];

      if (
        proyecto.latitud !== null &&
        proyecto.longitud !== null
      ) {
        map.current.flyTo({
          center: [
            proyecto.longitud,
            proyecto.latitud,
          ],
          zoom: 13,
        });
      }

      return;
    }

    map.current.fitBounds(
      bounds,
      {
        padding: 60,
        maxZoom: 13,
      },
    );
  }, [proyectos]);

  const tokenConfigurado =
    Boolean(
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN,
    );

  return (
    <div className={styles.wrapper}>
      {!tokenConfigurado && (
        <div
          className={styles.configuration}
          role="alert"
        >
          <strong>
            Mapbox no está configurado
          </strong>

          <span>
            Agrega VITE_MAPBOX_ACCESS_TOKEN
            al entorno del frontend.
          </span>
        </div>
      )}

      <div
        className={styles.map}
        ref={mapContainer}
        aria-label="Mapa de proyectos"
      />
    </div>
  );
}