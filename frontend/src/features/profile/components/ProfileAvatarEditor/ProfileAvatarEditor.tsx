import {
  useEffect,
  useState,
} from 'react';

import type {
  ChangeEvent,
} from 'react';

import type {
  Usuario,
} from '../../../auth/types/usuario';

import {
  eliminarAvatar,
  subirAvatar,
} from '../../api/avatar.api';

import {
  ApiError,
} from '../../../../shared/api/http';

import {
  AvatarCropper,
} from '../AvatarCropper/AvatarCropper';

import styles from './ProfileAvatarEditor.module.css';

interface ProfileAvatarEditorProps {
  usuario: Usuario;
  versionAvatar?: number;
  onActualizado: (
    fotoPerfilUrl: string | null,
  ) => void;
  onCancelar: () => void;
}

const MAX_BYTES_AVATAR = 5 * 1024 * 1024;


// Crear y revocar cada URL en el mismo efecto evita reutilizar una URL
// revocada y no produce efectos secundarios durante el renderizado.
function useImagenTemporal(archivo: File | null): string | null {
  const [imagen, setImagen] = useState<{
    archivo: File;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!archivo) {
      setImagen(null);
      return;
    }

    const url = URL.createObjectURL(archivo);
    setImagen({ archivo, url });

    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  return imagen?.archivo === archivo ? imagen.url : null;
}

export function ProfileAvatarEditor({
  usuario,
  versionAvatar = 0,
  onActualizado,
  onCancelar,
}: ProfileAvatarEditorProps) {
  const [archivo, setArchivo] =
    useState<File | null>(null);

  const [archivoOriginal, setArchivoOriginal] =
    useState<File | null>(null);

  // El archivo original determina si estamos ajustando el encuadre.
  const recortando = archivoOriginal !== null;

  const [enviando, setEnviando] =
    useState(false);

  const [eliminando, setEliminando] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const imagenOriginalUrl = useImagenTemporal(archivoOriginal);
  const vistaPrevia = useImagenTemporal(archivo);
  const fotoActualUrl = usuario.foto_perfil_url
    ? usuario.foto_perfil_url +
      (usuario.foto_perfil_url.includes('?') ? '&' : '?') +
      'v=' + versionAvatar
    : undefined;

  const tieneAvatar = Boolean(
    usuario.foto_perfil_url,
  );

  function seleccionarArchivo(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const nuevoArchivo =
      event.currentTarget.files?.[0] ?? null;

    // Leer el File antes de reiniciar permite elegirlo de nuevo.
    event.currentTarget.value = '';

    if (enviando || eliminando) {
      return;
    }

    setError(null);

    if (!nuevoArchivo) {
      return;
    }

    if (nuevoArchivo.size > MAX_BYTES_AVATAR) {
      setError(
        'La imagen no puede superar los 5 MB.',
      );
      return;
    }

    if (!nuevoArchivo.type.startsWith('image/')) {
      setError(
        'Debes seleccionar un archivo de imagen válido.',
      );
      return;
    }

    setArchivoOriginal(nuevoArchivo);
  }

  function confirmarRecorte(
    archivoRecortado: File,
  ) {
    if (archivoRecortado.size > MAX_BYTES_AVATAR) {
      setError(
        'La fotografía recortada supera los 5 MB.',
      );
      return;
    }

    setArchivo(archivoRecortado);
    setArchivoOriginal(null);
    setError(null);
  }

  function cancelarRecorte() {
    setArchivoOriginal(null);
    setError(null);
  }

  async function guardarAvatar() {
    if (
      !archivo ||
      enviando ||
      eliminando ||
      recortando
    ) {
      return;
    }

    try {
      setError(null);
      setEnviando(true);

      const respuesta = await subirAvatar(archivo);

      onActualizado(
        respuesta.foto_perfil_url,
      );
    } catch (errorDesconocido) {
      if (errorDesconocido instanceof ApiError) {
        setError(errorDesconocido.message);
        return;
      }

      setError(
        'No fue posible actualizar la foto de perfil.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function retirarAvatar() {
    if (
      enviando ||
      eliminando ||
      recortando
    ) {
      return;
    }

    try {
      setError(null);
      setEliminando(true);

      const respuesta = await eliminarAvatar();

      setArchivo(null);
      setArchivoOriginal(null);

      onActualizado(
        respuesta.foto_perfil_url,
      );
    } catch (errorDesconocido) {
      if (errorDesconocido instanceof ApiError) {
        setError(errorDesconocido.message);
        return;
      }

      setError(
        'No fue posible eliminar la foto de perfil.',
      );
    } finally {
      setEliminando(false);
    }
  }

  if (recortando) {
    return (
      <div className={styles.editor}>
        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}
        {imagenOriginalUrl ? (
          <AvatarCropper
            key={imagenOriginalUrl}
            imagenUrl={imagenOriginalUrl}
            onConfirmar={confirmarRecorte}
            onCancelar={cancelarRecorte}
          />
        ) : (
          <p role="status">Preparando imagen...</p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.previewSection}>
        <div className={styles.preview}>
          {vistaPrevia ? (
            <img
              src={vistaPrevia}
              alt="Vista previa de la nueva foto de perfil"
            />
          ) : tieneAvatar ? (
            <img
              src={fotoActualUrl}
              alt="Foto de perfil actual"
            />
          ) : (
            <span>Sin foto</span>
          )}
        </div>

        <div className={styles.previewInfo}>
          <strong>Foto de perfil</strong>

          <p>
            Selecciona una imagen y ajusta el
            encuadre antes de guardarla.
          </p>

          <span>
            Tamaño máximo: 5 MB.
          </span>
        </div>
      </div>

      {error && (
        <div
          className={styles.errorMessage}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className={styles.fileField}>
        <label htmlFor="avatar-file">
          Seleccionar imagen
        </label>

        <input
          id="avatar-file"
          type="file"
          accept="image/*"
          onChange={seleccionarArchivo}
          disabled={
            enviando ||
            eliminando
          }
        />
      </div>

      {archivo && (
        <div className={styles.selectedFile}>
          <span>
            Fotografía recortada
          </span>

          <strong>
            {archivo.name}
          </strong>
        </div>
      )}

      <div className={styles.actions}>
        {tieneAvatar && (
          <button
            className={styles.deleteButton}
            type="button"
            onClick={retirarAvatar}
            disabled={
              enviando ||
              eliminando
            }
          >
            {eliminando
              ? 'Eliminando...'
              : 'Eliminar foto'}
          </button>
        )}

        <div className={styles.mainActions}>
          <button
            className={styles.cancelButton}
            type="button"
            onClick={onCancelar}
            disabled={
              enviando ||
              eliminando
            }
          >
            Cancelar
          </button>

          <button
            className={styles.saveButton}
            type="button"
            onClick={guardarAvatar}
            disabled={
              !archivo ||
              enviando ||
              eliminando
            }
          >
            {enviando
              ? 'Guardando...'
              : 'Guardar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
