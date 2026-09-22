import {
  useRef,
  useState,
} from 'react';

import { ApiError } from '../../../../shared/api/http';

import {
  actualizarMiPerfil,
} from '../../api/profile.api';

import type {
  Usuario,
} from '../../../auth/types/usuario';

import styles from './ProfileEditForm.module.css';

interface ProfileEditFormProps {
  usuario: Usuario;
  onActualizado: (usuario: Usuario) => void;
  onCancelar: () => void;
}

interface FormularioPerfil {
  nombre: string;
  apellidos: string;
  telefono: string;
  ubicacion: string;
}

export function ProfileEditForm({
  usuario,
  onActualizado,
  onCancelar,
}: ProfileEditFormProps) {
  const [
    formulario,
    setFormulario,
  ] = useState<FormularioPerfil>({
    nombre:
      usuario.nombre ?? '',

    apellidos:
      usuario.apellidos ?? '',

    telefono:
      usuario.telefono ?? '',

    ubicacion:
      usuario.ubicacion ?? '',
  });

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const envioActivo =
    useRef(false);

  function actualizarCampo(
    campo: keyof FormularioPerfil,
    valor: string,
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function validarFormulario():
    | string
    | null {
    if (
      formulario.nombre.trim().length >
      100
    ) {
      return 'El nombre no puede superar 100 caracteres.';
    }

    if (
      formulario.apellidos.trim().length >
      150
    ) {
      return 'Los apellidos no pueden superar 150 caracteres.';
    }

    if (
      formulario.telefono.trim().length >
      32
    ) {
      return 'El teléfono no puede superar 32 caracteres.';
    }

    if (
      formulario.ubicacion.trim().length >
      200
    ) {
      return 'La ubicación no puede superar 200 caracteres.';
    }

    return null;
  }

  async function enviar(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (envioActivo.current) {
      return;
    }

    const mensajeValidacion =
      validarFormulario();

    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }

    const nombre =
      formulario.nombre.trim();

    const apellidos =
      formulario.apellidos.trim();

    const telefono =
      formulario.telefono.trim();

    const ubicacion =
      formulario.ubicacion.trim();

    const datos: {
      nombre?: string | null;
      apellidos?: string | null;
      telefono?: string | null;
      ubicacion?: string | null;
    } = {};

    const nombreActual =
      usuario.nombre ?? '';

    const apellidosActuales =
      usuario.apellidos ?? '';

    const telefonoActual =
      usuario.telefono ?? '';

    const ubicacionActual =
      usuario.ubicacion ?? '';

    if (nombre !== nombreActual) {
      datos.nombre =
        nombre || null;
    }

    if (
      apellidos !==
      apellidosActuales
    ) {
      datos.apellidos =
        apellidos || null;
    }

    if (
      telefono !==
      telefonoActual
    ) {
      datos.telefono =
        telefono || null;
    }

    if (
      ubicacion !==
      ubicacionActual
    ) {
      datos.ubicacion =
        ubicacion || null;
    }

    if (
      Object.keys(datos).length === 0
    ) {
      setError(
        'No hay cambios para guardar.',
      );

      return;
    }

    envioActivo.current = true;

    setGuardando(true);
    setError(null);

    try {
      const usuarioActualizado =
        await actualizarMiPerfil(
          datos,
        );

      onActualizado(
        usuarioActualizado,
      );
    } catch (errorCapturado) {
      if (
        errorCapturado instanceof ApiError
      ) {
        setError(
          errorCapturado.message,
        );
      } else {
        setError(
          'No fue posible actualizar el perfil. Inténtalo nuevamente.',
        );
      }
    } finally {
      envioActivo.current = false;

      setGuardando(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={enviar}
    >
      <div className={styles.fields}>
        <label
          className={styles.field}
        >
          <span>
            Nombre
          </span>

          <input
            type="text"
            maxLength={100}
            value={formulario.nombre}
            onChange={(event) =>
              actualizarCampo(
                'nombre',
                event.target.value,
              )
            }
            disabled={guardando}
            autoComplete="given-name"
          />
        </label>

        <label
          className={styles.field}
        >
          <span>
            Apellidos
          </span>

          <input
            type="text"
            maxLength={150}
            value={
              formulario.apellidos
            }
            onChange={(event) =>
              actualizarCampo(
                'apellidos',
                event.target.value,
              )
            }
            disabled={guardando}
            autoComplete="family-name"
          />
        </label>

        <label
          className={styles.field}
        >
          <span>
            Teléfono
          </span>

          <input
            type="tel"
            maxLength={32}
            value={
              formulario.telefono
            }
            onChange={(event) =>
              actualizarCampo(
                'telefono',
                event.target.value,
              )
            }
            disabled={guardando}
            autoComplete="tel"
            placeholder="+57 300 000 0000"
          />
        </label>

        <label
          className={styles.field}
        >
          <span>
            Ubicación
          </span>

          <input
            type="text"
            maxLength={200}
            value={
              formulario.ubicacion
            }
            onChange={(event) =>
              actualizarCampo(
                'ubicacion',
                event.target.value,
              )
            }
            disabled={guardando}
            autoComplete="address-level2"
            placeholder="Ciudad, departamento"
          />
        </label>

        <div
          className={`${styles.field} ${styles.fieldFull}`}
        >
          <span>
            Correo electrónico
          </span>

          <div
            className={styles.readOnlyField}
          >
            <span>
              {usuario.correo}
            </span>

            <small>
              El correo no se modifica desde
              este formulario.
            </small>
          </div>
        </div>
      </div>

      {error && (
        <div
          className={styles.error}
          role="alert"
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

            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>

          <span>
            {error}
          </span>
        </div>
      )}

      <footer className={styles.actions}>
        <button
          className={styles.cancelButton}
          type="button"
          onClick={onCancelar}
          disabled={guardando}
        >
          Cancelar
        </button>

        <button
          className={styles.submitButton}
          type="submit"
          disabled={guardando}
        >
          {guardando
            ? 'Guardando...'
            : 'Guardar cambios'}
        </button>
      </footer>
    </form>
  );
}