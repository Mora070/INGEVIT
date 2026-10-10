
import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';

import type {
  Area,
  Point,
} from 'react-easy-crop';

import styles from './AvatarCropper.module.css';

interface AvatarCropperProps {
  imagenUrl: string;
  onConfirmar: (archivo: File) => void;
  onCancelar: () => void;
}

const TAMANO_SALIDA = 512;

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(
      new Error('No fue posible cargar la imagen.'),
    );

    imagen.src = src;
  });
}

async function generarImagenRecortada(
  imagenUrl: string,
  area: Area,
): Promise<File> {
  const imagen = await cargarImagen(imagenUrl);

  const canvas = document.createElement('canvas');
  canvas.width = TAMANO_SALIDA;
  canvas.height = TAMANO_SALIDA;

  const contexto = canvas.getContext('2d');

  if (!contexto) {
    throw new Error('No fue posible procesar la imagen.');
  }

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';

  contexto.drawImage(
    imagen,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    TAMANO_SALIDA,
    TAMANO_SALIDA,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (resultado) => {
        if (resultado) {
          resolve(resultado);
        } else {
          reject(
            new Error('No fue posible generar la fotografía recortada.'),
          );
        }
      },
      'image/jpeg',
      0.9,
    );
  });

  return new File(
    [blob],
    'foto-perfil.jpg',
    {
      type: 'image/jpeg',
      lastModified: Date.now(),
    },
  );
}

export function AvatarCropper({
  imagenUrl,
  onConfirmar,
  onCancelar,
}: AvatarCropperProps) {
  const [crop, setCrop] = useState<Point>({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] = useState(1);
  const [areaRecortada, setAreaRecortada] =
    useState<Area | null>(null);

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alCompletarRecorte = useCallback(
    (_area: Area, areaPixels: Area) => {
      setAreaRecortada(areaPixels);
    },
    [],
  );

  async function confirmarRecorte() {
    if (!areaRecortada || procesando) {
      return;
    }

    try {
      setProcesando(true);
      setError(null);

      const archivo = await generarImagenRecortada(
        imagenUrl,
        areaRecortada,
      );

      onConfirmar(archivo);
    } catch {
      setError(
        'No fue posible recortar la fotografía. Inténtalo nuevamente.',
      );
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h3>Ajustar fotografía</h3>
        <p>
          Arrastra la imagen para seleccionar qué parte
          deseas mostrar en tu perfil.
        </p>
      </div>

      <div className={styles.cropContainer}>
        <Cropper
          image={imagenUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          minZoom={1}
          maxZoom={3}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={alCompletarRecorte}
          objectFit="contain"
        />
      </div>

      <div className={styles.zoomSection}>
        <div className={styles.zoomHeader}>
          <label htmlFor="avatar-zoom">
            Zoom
          </label>
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        <input
          id="avatar-zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => {
            setZoom(Number(event.target.value));
          }}
          disabled={procesando}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancelar}
          disabled={procesando}
        >
          Cancelar
        </button>

        <button
          type="button"
          className={styles.confirmButton}
          onClick={confirmarRecorte}
          disabled={!areaRecortada || procesando}
        >
          {procesando ? 'Procesando...' : 'Aplicar recorte'}
        </button>
      </div>
    </div>
  );
}
