import {
  useEffect,
  useRef,
  useState,
} from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import styles from './ProjectLocationPicker.module.css';

interface ProjectLocationPickerProps {
  direccion: string;

  latitud: number | null;
  longitud: number | null;

  disabled?: boolean;

  onChange: (
    latitud: number,
    longitud: number,
  ) => void;

  onLimpiar: () => void;
}

interface ResultadoGeocodificacion {
  features?: Array<{
    geometry?: {
      coordinates?: [
        number,
        number,
      ];
    };
  }>;
}

const CENTRO_INICIAL: [
  number,
  number,
] = [
  -74.2973,
  4.5709,
];

export function ProjectLocationPicker({
  direccion,
  latitud,
  longitud,
  disabled = false,
  onChange,
  onLimpiar,
}: ProjectLocationPickerProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const map =
    useRef<mapboxgl.Map | null>(null);

  const marker =
    useRef<mapboxgl.Marker | null>(null);

  const onChangeRef =
    useRef(onChange);

  const [
    buscando,
    setBuscando,
  ] = useState(false);

  const [
    obteniendoUbicacion,
    setObteniendoUbicacion,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current =
      onChange;
  }, [onChange]);

  useEffect(() => {
    const accessToken =
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN;

    if (
      !mapContainer.current ||
      map.current ||
      !accessToken
    ) {
      return;
    }

    mapboxgl.accessToken =
      accessToken;

    const tieneCoordenadas =
      latitud !== null &&
      longitud !== null;

    const mapa =
      new mapboxgl.Map({
        container:
          mapContainer.current,

        style:
          'mapbox://styles/mapbox/streets-v12',

        center:
          tieneCoordenadas
            ? [
                longitud,
                latitud,
              ]
            : CENTRO_INICIAL,

        zoom:
          tieneCoordenadas
            ? 15
            : 5,
      });

    mapa.addControl(
      new mapboxgl.NavigationControl(),
      'top-right',
    );

    mapa.on(
      'click',
      (event) => {
        if (disabled) {
          return;
        }

        const nuevaLongitud =
          event.lngLat.lng;

        const nuevaLatitud =
          event.lngLat.lat;

        colocarMarcador(
          nuevaLatitud,
          nuevaLongitud,
          mapa,
        );

        onChangeRef.current(
          nuevaLatitud,
          nuevaLongitud,
        );
      },
    );

    map.current =
      mapa;

    return () => {
      marker.current?.remove();

      marker.current = null;

      mapa.remove();

      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !map.current ||
      latitud === null ||
      longitud === null
    ) {
      if (
        latitud === null &&
        longitud === null
      ) {
        marker.current?.remove();

        marker.current = null;
      }

      return;
    }

    colocarMarcador(
      latitud,
      longitud,
      map.current,
    );
  }, [
    latitud,
    longitud,
  ]);

  function colocarMarcador(
    nuevaLatitud: number,
    nuevaLongitud: number,
    mapa: mapboxgl.Map,
  ) {
    if (!marker.current) {
      const nuevoMarcador =
        new mapboxgl.Marker({
          color: '#ea751a',
          draggable: !disabled,
        })
          .setLngLat([
            nuevaLongitud,
            nuevaLatitud,
          ])
          .addTo(mapa);

      nuevoMarcador.on(
        'dragend',
        () => {
          const posicion =
            nuevoMarcador.getLngLat();

          onChangeRef.current(
            posicion.lat,
            posicion.lng,
          );
        },
      );

      marker.current =
        nuevoMarcador;

      return;
    }

    marker.current.setLngLat([
      nuevaLongitud,
      nuevaLatitud,
    ]);
  }

  async function buscarDireccion() {
    const consulta =
      direccion.trim();

    if (!consulta) {
      setError(
        'Escribe primero la dirección del proyecto.',
      );

      return;
    }

    const accessToken =
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN;

    if (!accessToken) {
      setError(
        'Mapbox no está configurado.',
      );

      return;
    }

    setBuscando(true);
    setError(null);

    try {
      const parametros =
        new URLSearchParams({
          q: consulta,
          access_token:
            accessToken,
          limit: '1',
          language: 'es',
        });

      const respuesta =
        await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?${parametros.toString()}`,
          {
            method: 'GET',
            headers: {
              Accept:
                'application/json',
            },
          },
        );

      if (!respuesta.ok) {
        throw new Error(
          'No fue posible buscar la dirección.',
        );
      }

      const datos =
        (await respuesta.json()) as ResultadoGeocodificacion;

      const coordenadas =
        datos.features?.[0]
          ?.geometry
          ?.coordinates;

      if (!coordenadas) {
        setError(
          'No encontramos esa dirección. Puedes seleccionar el punto manualmente en el mapa.',
        );

        return;
      }

      const [
        nuevaLongitud,
        nuevaLatitud,
      ] = coordenadas;

      onChange(
        nuevaLatitud,
        nuevaLongitud,
      );

      if (map.current) {
        colocarMarcador(
          nuevaLatitud,
          nuevaLongitud,
          map.current,
        );

        map.current.flyTo({
          center: [
            nuevaLongitud,
            nuevaLatitud,
          ],

          zoom: 16,
        });
      }
    } catch {
      setError(
        'No fue posible buscar la dirección. Inténtalo nuevamente.',
      );
    } finally {
      setBuscando(false);
    }
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) {
      setError(
        'Tu navegador no permite obtener la ubicación actual.',
      );

      return;
    }

    setObteniendoUbicacion(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const nuevaLatitud =
          posicion.coords.latitude;

        const nuevaLongitud =
          posicion.coords.longitude;

        onChange(
          nuevaLatitud,
          nuevaLongitud,
        );

        if (map.current) {
          colocarMarcador(
            nuevaLatitud,
            nuevaLongitud,
            map.current,
          );

          map.current.flyTo({
            center: [
              nuevaLongitud,
              nuevaLatitud,
            ],

            zoom: 16,
          });
        }

        setObteniendoUbicacion(false);
      },

      (errorGeolocalizacion) => {
        if (
          errorGeolocalizacion.code ===
          errorGeolocalizacion.PERMISSION_DENIED
        ) {
          setError(
            'No se concedió permiso para utilizar tu ubicación.',
          );
        } else {
          setError(
            'No fue posible obtener tu ubicación actual.',
          );
        }

        setObteniendoUbicacion(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );
  }

  function limpiarUbicacion() {
    marker.current?.remove();

    marker.current = null;

    onLimpiar();

    setError(null);

    map.current?.flyTo({
      center:
        CENTRO_INICIAL,

      zoom: 5,
    });
  }

  const tokenConfigurado =
    Boolean(
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN,
    );

  const tieneUbicacion =
    latitud !== null &&
    longitud !== null;

  return (
    <div className={styles.picker}>
      <div className={styles.actions}>
        <button
          className={
            styles.searchButton
          }
          type="button"
          onClick={() => {
            void buscarDireccion();
          }}
          disabled={
            disabled ||
            buscando ||
            !direccion.trim()
          }
        >
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

          <span>
            {buscando
              ? 'Buscando...'
              : 'Buscar dirección'}
          </span>
        </button>

        <button
          className={
            styles.locationButton
          }
          type="button"
          onClick={
            usarUbicacionActual
          }
          disabled={
            disabled ||
            obteniendoUbicacion
          }
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="3"
            />

            <circle
              cx="12"
              cy="12"
              r="8"
            />

            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
          </svg>

          <span>
            {obteniendoUbicacion
              ? 'Obteniendo ubicación...'
              : 'Usar mi ubicación actual'}
          </span>
        </button>
      </div>

      <div className={styles.mapWrapper}>
        {!tokenConfigurado && (
          <div
            className={
              styles.configuration
            }
            role="alert"
          >
            Mapbox no está configurado.
          </div>
        )}

        <div
          ref={mapContainer}
          className={styles.map}
          aria-label="Seleccionar ubicación del proyecto"
        />

        {tokenConfigurado &&
          !tieneUbicacion && (
            <div
              className={
                styles.mapHint
              }
            >
              Haz clic en el mapa para
              seleccionar la ubicación.
            </div>
          )}
      </div>

      {tieneUbicacion && (
        <div
          className={
            styles.coordinates
          }
        >
          <div>
            <span>
              Latitud
            </span>

            <strong>
              {latitud.toFixed(6)}
            </strong>
          </div>

          <div>
            <span>
              Longitud
            </span>

            <strong>
              {longitud.toFixed(6)}
            </strong>
          </div>

          <button
            type="button"
            className={
              styles.clearButton
            }
            onClick={
              limpiarUbicacion
            }
            disabled={disabled}
          >
            Quitar ubicación
          </button>
        </div>
      )}

      {error && (
        <p
          className={styles.error}
          role="alert"
        >
          {error}
        </p>
      )}

      <p className={styles.help}>
        Puedes buscar la dirección,
        seleccionar un punto directamente
        en el mapa o usar la ubicación
        actual de tu dispositivo. El
        marcador también se puede
        arrastrar para ajustar el punto
        exacto.
      </p>
    </div>
  );
}