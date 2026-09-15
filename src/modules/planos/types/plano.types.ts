/**
 * Registro interno devuelto por PostgreSQL.
 * s3_key se utiliza exclusivamente dentro del backend.
 */
export interface PlanoRow {
  id_plano: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  descripcion: string;
  url: string;
  s3_key: string;
  mime_type: 'application/pdf';
  fecha_subida: Date;
}

/**
 * Representación pública del plano.
 * La fecha se transmite como texto ISO.
 */
export interface PlanoResponse {
  id_plano: string;
  id_proyecto: string;
  id_usuario_subida: string;
  titulo: string;
  descripcion: string;
  url: string;
  mime_type: 'application/pdf';
  fecha_subida: string;
}