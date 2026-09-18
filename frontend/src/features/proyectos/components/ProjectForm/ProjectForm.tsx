import {
  useRef,
  useState,
} from 'react';

import { ApiError } from '../../../../shared/api/http';

import {
  crearProyecto,
} from '../../api/proyectos.api';

import { ProjectLocationPicker } from '../ProjectLocationPicker/ProjectLocationPicker';

import type {
  EstadoProyecto,
  Proyecto,
} from '../../types/proyecto';

import styles from './ProjectForm.module.css';

interface ProjectFormProps {
  onCreado: (proyecto: Proyecto) => void;
  onCancelar: () => void;
}

interface FormularioProyecto {
  nombre: string;
  descripcion: string;
  direccion: string;
  contratante: string;

  fechaInicio: string;
  fechaFinalizacion: string;

  estadoProyecto: EstadoProyecto;

  latitud: number | null;
  longitud: number | null;
}

const FORMULARIO_INICIAL: FormularioProyecto = {
  nombre: '',
  descripcion: '',
  direccion: '',
  contratante: '',

  fechaInicio: '',
  fechaFinalizacion: '',

  estadoProyecto: 'ACTIVA',

  latitud: null,
  longitud: null,
};

export function ProjectForm({
  onCreado,
  onCancelar,
}: ProjectFormProps) {
  const [
    formulario,
    setFormulario,
  ] = useState<FormularioProyecto>(
    FORMULARIO_INICIAL,
  );

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

  function actualizarCampo<
    Campo extends keyof FormularioProyecto,
  >(
    campo: Campo,
    valor: FormularioProyecto[Campo],
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function actualizarUbicacion(
    latitud: number,
    longitud: number,
  ) {
    setFormulario((actual) => ({
      ...actual,
      latitud,
      longitud,
    }));

    setError(null);
  }

  function limpiarUbicacion() {
    setFormulario((actual) => ({
      ...actual,
      latitud: null,
      longitud: null,
    }));
  }

  function validarFormulario():
    | string
    | null {
    if (!formulario.nombre.trim()) {
      return 'El nombre del proyecto es obligatorio.';
    }

    if (!formulario.descripcion.trim()) {
      return 'La descripción es obligatoria.';
    }

    if (!formulario.direccion.trim()) {
      return 'La dirección es obligatoria.';
    }

    if (!formulario.contratante.trim()) {
      return 'El contratante es obligatorio.';
    }

    if (!formulario.fechaInicio) {
      return 'La fecha de inicio es obligatoria.';
    }

    if (
      formulario.fechaFinalizacion &&
      formulario.fechaFinalizacion <
        formulario.fechaInicio
    ) {
      return 'La fecha de finalización no puede ser anterior a la fecha de inicio.';
    }

    const tieneLatitud =
      formulario.latitud !== null;

    const tieneLongitud =
      formulario.longitud !== null;

    if (
      tieneLatitud !==
      tieneLongitud
    ) {
      return 'La ubicación del proyecto está incompleta.';
    }

    if (
      formulario.latitud !== null &&
      (
        formulario.latitud < -90 ||
        formulario.latitud > 90
      )
    ) {
      return 'La latitud seleccionada no es válida.';
    }

    if (
      formulario.longitud !== null &&
      (
        formulario.longitud < -180 ||
        formulario.longitud > 180
      )
    ) {
      return 'La longitud seleccionada no es válida.';
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

    envioActivo.current = true;

    setGuardando(true);
    setError(null);

    try {
      const proyecto =
        await crearProyecto({
          nombre:
            formulario.nombre.trim(),

          descripcion:
            formulario.descripcion.trim(),

          direccion:
            formulario.direccion.trim(),

          contratante:
            formulario.contratante.trim(),

          fecha_inicio:
            formulario.fechaInicio,

          fecha_finalizacion:
            formulario.fechaFinalizacion ||
            null,

          estado_proyecto:
            formulario.estadoProyecto,

          latitud:
            formulario.latitud,

          longitud:
            formulario.longitud,
        });

      onCreado(proyecto);
    } catch (errorCapturado) {
      if (
        errorCapturado instanceof ApiError
      ) {
        setError(
          errorCapturado.message,
        );
      } else {
        setError(
          'No fue posible crear el proyecto. Inténtalo nuevamente.',
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
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Información general
          </h2>

          <p>
            Ingresa los datos principales
            del proyecto.
          </p>
        </div>

        <div className={styles.fields}>
          <label
            className={styles.field}
          >
            <span>
              Nombre del proyecto
            </span>

            <input
              type="text"
              value={formulario.nombre}
              onChange={(event) =>
                actualizarCampo(
                  'nombre',
                  event.target.value,
                )
              }
              autoComplete="off"
              disabled={guardando}
              required
            />
          </label>

          <label
            className={styles.field}
          >
            <span>
              Contratante
            </span>

            <input
              type="text"
              value={
                formulario.contratante
              }
              onChange={(event) =>
                actualizarCampo(
                  'contratante',
                  event.target.value,
                )
              }
              autoComplete="organization"
              disabled={guardando}
              required
            />
          </label>

          <label
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <span>
              Descripción
            </span>

            <textarea
              value={
                formulario.descripcion
              }
              onChange={(event) =>
                actualizarCampo(
                  'descripcion',
                  event.target.value,
                )
              }
              rows={4}
              disabled={guardando}
              required
            />
          </label>

          <label
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <span>
              Dirección
            </span>

            <input
              type="text"
              value={
                formulario.direccion
              }
              onChange={(event) =>
                actualizarCampo(
                  'direccion',
                  event.target.value,
                )
              }
              autoComplete="street-address"
              disabled={guardando}
              required
            />
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Fechas y estado
          </h2>

          <p>
            Define el periodo y estado
            actual del proyecto.
          </p>
        </div>

        <div className={styles.fields}>
          <label
            className={styles.field}
          >
            <span>
              Fecha de inicio
            </span>

            <input
              type="date"
              value={
                formulario.fechaInicio
              }
              onChange={(event) =>
                actualizarCampo(
                  'fechaInicio',
                  event.target.value,
                )
              }
              disabled={guardando}
              required
            />
          </label>

          <label
            className={styles.field}
          >
            <span>
              Fecha de finalización
            </span>

            <input
              type="date"
              value={
                formulario.fechaFinalizacion
              }
              min={
                formulario.fechaInicio ||
                undefined
              }
              onChange={(event) =>
                actualizarCampo(
                  'fechaFinalizacion',
                  event.target.value,
                )
              }
              disabled={guardando}
            />
          </label>

          <label
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <span>
              Estado del proyecto
            </span>

            <select
              value={
                formulario.estadoProyecto
              }
              onChange={(event) =>
                actualizarCampo(
                  'estadoProyecto',
                  event.target
                    .value as EstadoProyecto,
                )
              }
              disabled={guardando}
            >
              <option value="ACTIVA">
                Activa
              </option>

              <option value="PAUSA">
                En pausa
              </option>

              <option value="FINALIZADA">
                Finalizada
              </option>
            </select>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>
            Ubicación
          </h2>

          <p>
            Selecciona el punto exacto del
            proyecto para mostrarlo en el
            mapa de INGEVIT.
          </p>
        </div>

        <ProjectLocationPicker
          direccion={
            formulario.direccion
          }
          latitud={
            formulario.latitud
          }
          longitud={
            formulario.longitud
          }
          disabled={guardando}
          onChange={
            actualizarUbicacion
          }
          onLimpiar={
            limpiarUbicacion
          }
        />
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
            ? 'Creando proyecto...'
            : 'Crear proyecto'}
        </button>
      </footer>
    </form>
  );
}