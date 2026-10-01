export type DestinoProyecto =
  | 'RESUMEN'
  | 'FOTOGRAFIAS'
  | 'PLANOS'
  | 'PANORAMICAS'
  | 'MAPA'
  | 'CAPAS'
  | 'COLABORADORES';

export interface NavegacionProyecto {
  clave: string;

  destino:
    DestinoProyecto | null;

  idRecurso:
    string | null;
}