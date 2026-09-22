import {
  useEffect,
  useMemo,
  useState,
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

import styles from './ProfileAvatarEditor.module.css';

interface ProfileAvatarEditorProps {
  usuario: Usuario;
  onActualizado: (
    fotoPerfilUrl: string | null,
  ) => void;
  onCancelar: () => void;
}

const MAX_BYTES_AVATAR =
  5 * 1024 * 1024;

export function ProfileAvatarEditor({
  usuario,
  onActualizado,
  onCancelar,
}: ProfileAvatarEditorProps) {
  const [
    archivo,
    setArchivo,
  ] = useState<File | null>(null);

  const [
    enviando,
    setEnviando,
  ] = useState(false);

  const [
    eliminando,
    setEliminando,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const vistaPrevia = useMemo(() => {
    if (!archivo) {
      return null;
    }

    return URL.createObjectURL(
      archivo,
    );
  }, [archivo]);

  useEffect(() => {
    return () => {
      if (vistaPrevia) {
        URL.revokeObjectURL(
          vistaPrevia,
        );
      }
    };
  }, [vistaPrevia]);

  const tieneAvatar =
    Boolean(
      usuario.foto_perfil_url,
    );

  function seleccionarArchivo(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const nuevoArchivo =
      event.target.files?.[0] ??
      null;

    setError(null);

    if (!nuevoArchivo) {
      setArchivo(null);

      return;
    }

    if (
      nuevoArchivo.size >
      MAX_BYTES_AVATAR
    ) {
      setArchivo(null);

      event.target.value = '';

      setError(
        'La imagen no puede superar los 5 MB.',
      );

      return;
    }

    if (
      !nuevoArchivo.type.startsWith(
        'image/',
      )
    ) {
      setArchivo(null);

      event.target.value = '';

      setError(
        'Debes seleccionar un archivo de imagen válido.',
      );

      return;
    }

    setArchivo(
      nuevoArchivo,
    );
  }

  async function guardarAvatar() {
    if (
      !archivo ||
      enviando ||
      eliminando
    ) {
      return;
    }

    try {
      setError(null);
      setEnviando(true);

      const respuesta =
        await subirAvatar(
          archivo,
        );

      onActualizado(
        respuesta.foto_perfil_url,
      );
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof
        ApiError
      ) {
        setError(
          errorDesconocido.message,
        );

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
      eliminando
    ) {
      return;
    }

    try {
      setError(null);
      setEliminando(true);

      const respuesta =
        await eliminarAvatar();

      onActualizado(
        respuesta.foto_perfil_url,
      );
    } catch (errorDesconocido) {
      if (
        errorDesconocido instanceof
        ApiError
      ) {
        setError(
          errorDesconocido.message,
        );

        return;
      }

      setError(
        'No fue posible eliminar la foto de perfil.',
      );
    } finally {
      setEliminando(false);
    }
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
              src={
                usuario.foto_perfil_url ??
                undefined
              }
              alt="Foto de perfil actual"
            />
          ) : (
            <span>
              Sin foto
            </span>
          )}
        </div>

        <div className={styles.previewInfo}>
          <strong>
            Foto de perfil
          </strong>

          <p>
            Selecciona una imagen para
            usarla como foto de tu cuenta.
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
            Archivo seleccionado
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