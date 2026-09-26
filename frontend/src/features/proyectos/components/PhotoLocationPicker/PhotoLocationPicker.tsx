import {
  useEffect,
  useRef,
  useState,
} from 'react';

import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

import styles from './PhotoLocationPicker.module.css';

interface PhotoLocationPickerProps {
  latitud: number | null;
  longitud: number | null;

  /**
   * Coordenadas opcionales utilizadas únicamente
   * para centrar inicialmente el mapa.
   *
   * Por ejemplo, la ubicación general del proyecto.
   */
  latitudReferencia?: number | null;
  longitudReferencia?: number | null;

  disabled?: boolean;

  onChange: (
    latitud: number,
    longitud: number,
  ) => void;

  onLimpiar: () => void;
}

const CENTRO_COLOMBIA: [
  number,
  number,
] = [
  -74.2973,
  4.5709,
];

export function PhotoLocationPicker({
  latitud,
  longitud,
  latitudReferencia = null,
  longitudReferencia = null,
  disabled = false,
  onChange,
  onLimpiar,
}: PhotoLocationPickerProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(
      null,
    );

  const map =
    useRef<mapboxgl.Map | null>(
      null,
    );

  const marker =
    useRef<mapboxgl.Marker | null>(
      null,
    );

  const onChangeRef =
    useRef(onChange);

  const [
    obteniendoUbicacion,
    setObteniendoUbicacion,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    onChangeRef.current =
      onChange;
  }, [
    onChange,
  ]);

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

    const tieneUbicacionFoto =
      latitud !== null &&
      longitud !== null;

    const tieneReferencia =
      latitudReferencia !== null &&
      longitudReferencia !== null;

    const centro: [
      number,
      number,
    ] =
      tieneUbicacionFoto
        ? [
            longitud,
            latitud,
          ]
        : tieneReferencia
          ? [
              longitudReferencia,
              latitudReferencia,
            ]
          : CENTRO_COLOMBIA;

    const zoomInicial =
      tieneUbicacionFoto
        ? 16
        : tieneReferencia
          ? 15
          : 5;

    const mapa =
      new mapboxgl.Map({
        container:
          mapContainer.current,

        style:
          'mapbox://styles/mapbox/streets-v12',

        center:
          centro,

        zoom:
          zoomInicial,
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

        const nuevaLatitud =
          event.lngLat.lat;

        const nuevaLongitud =
          event.lngLat.lng;

        colocarMarcador(
          nuevaLatitud,
          nuevaLongitud,
          mapa,
        );

        onChangeRef.current(
          nuevaLatitud,
          nuevaLongitud,
        );

        setError(
          null,
        );
      },
    );

    map.current =
      mapa;

    return () => {
      marker.current?.remove();

      marker.current =
        null;

      mapa.remove();

      map.current =
        null;
    };
  }, []);

  useEffect(() => {
    if (
      !map.current
    ) {
      return;
    }

    if (
      latitud === null ||
      longitud === null
    ) {
      marker.current?.remove();

      marker.current =
        null;

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
    mapaActual: mapboxgl.Map,
  ) {
    if (!marker.current) {
      const nuevoMarcador =
        new mapboxgl.Marker({
          color: '#ea751a',
          draggable:
            !disabled,
        })
          .setLngLat([
            nuevaLongitud,
            nuevaLatitud,
          ])
          .addTo(
            mapaActual,
          );

      nuevoMarcador.on(
        'dragend',
        () => {
          if (disabled) {
            return;
          }

          const posicion =
            nuevoMarcador.getLngLat();

          onChangeRef.current(
            posicion.lat,
            posicion.lng,
          );

          setError(
            null,
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

  function usarUbicacionProyecto() {
    if (
      disabled ||
      latitudReferencia === null ||
      longitudReferencia === null
    ) {
      return;
    }

    onChange(
      latitudReferencia,
      longitudReferencia,
    );

    setError(
      null,
    );

    if (map.current) {
      colocarMarcador(
        latitudReferencia,
        longitudReferencia,
        map.current,
      );

      map.current.flyTo({
        center: [
          longitudReferencia,
          latitudReferencia,
        ],

        zoom: 16,
      });
    }
  }

  function usarUbicacionActual() {
    if (
      disabled ||
      obteniendoUbicacion
    ) {
      return;
    }

    if (
      !navigator.geolocation
    ) {
      setError(
        'Tu navegador no permite obtener la ubicación actual.',
      );

      return;
    }

    setObteniendoUbicacion(
      true,
    );

    setError(
      null,
    );

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

        setObteniendoUbicacion(
          false,
        );
      },

      (
        errorGeolocalizacion,
      ) => {
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

        setObteniendoUbicacion(
          false,
        );
      },

      {
        enableHighAccuracy:
          true,

        timeout:
          10_000,

        maximumAge:
          30_000,
      },
    );
  }

  function limpiarUbicacion() {
    if (disabled) {
      return;
    }

    marker.current?.remove();

    marker.current =
      null;

    onLimpiar();

    setError(
      null,
    );
  }

  const tokenConfigurado =
    Boolean(
      import.meta.env
        .VITE_MAPBOX_ACCESS_TOKEN,
    );

  const tieneUbicacion =
    latitud !== null &&
    longitud !== null;

  const tieneUbicacionProyecto =
    latitudReferencia !== null &&
    longitudReferencia !== null;

  return (
    <div
      className={
        styles.picker
      }
    >
      <div
        className={
          styles.header
        }
      >
        <div>
          <h3>
            Ubicación de la fotografía
          </h3>

          <p>
            Selecciona en el mapa el
            punto donde fue tomada la
            fotografía.
          </p>
        </div>
      </div>

      <div
        className={
          styles.actions
        }
      >
        {tieneUbicacionProyecto && (
          <button
            className={
              styles.projectButton
            }
            type="button"
            onClick={
              usarUbicacionProyecto
            }
            disabled={
              disabled
            }
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
              />

              <circle
                cx="12"
                cy="9"
                r="2"
              />
            </svg>

            <span>
              Usar ubicación del proyecto
            </span>
          </button>
        )}

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

      <div
        className={
          styles.mapWrapper
        }
      >
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
          ref={
            mapContainer
          }
          className={
            styles.map
          }
          aria-label="Seleccionar ubicación de la fotografía"
        />

        {tokenConfigurado &&
          !tieneUbicacion && (
            <div
              className={
                styles.mapHint
              }
            >
              Haz clic en el mapa para
              marcar dónde fue tomada
              la fotografía.
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
              {latitud.toFixed(
                6,
              )}
            </strong>
          </div>

          <div>
            <span>
              Longitud
            </span>

            <strong>
              {longitud.toFixed(
                6,
              )}
            </strong>
          </div>

          <button
            className={
              styles.clearButton
            }
            type="button"
            onClick={
              limpiarUbicacion
            }
            disabled={
              disabled
            }
          >
            Quitar ubicación
          </button>
        </div>
      )}

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

      <p
        className={
          styles.help
        }
      >
        Puedes hacer clic directamente
        sobre el mapa, mover el marcador
        arrastrándolo, usar la ubicación
        general del proyecto o utilizar
        la ubicación actual del
        dispositivo.
      </p>
    </div>
  );
}