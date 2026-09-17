/**
 * Campos personales que el repositorio permite actualizar.
 *
 * undefined: conserva el dato existente.
 * null: elimina el dato.
 * string: reemplaza el dato.
 *
 * La validación y normalización pertenecen a la capa de entrada.
 * La identidad del usuario se recibe por separado.
 */
export interface ActualizarPerfilInput {
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  ubicacion?: string | null;
}