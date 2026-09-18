/**
 * Etapa en la que no se obtuvo una confirmación suficiente
 * para decidir si es seguro compensar recursos externos.
 */
export type EtapaTransaccionIncierta =
  | 'COMMIT'
  | 'ROLLBACK';

/**
 * Señala que no debe asumirse una reversión confirmada.
 *
 * Los servicios que coordinan PostgreSQL con archivos no deben
 * eliminar esos archivos automáticamente al recibir este error.
 *
 * Es un error interno, no una excepción HTTP de negocio.
 * Sus causas no deben enviarse directamente al cliente.
 */
export class ResultadoTransaccionDesconocidoError extends Error {
  /**
   * COMMIT: se intentó confirmar, pero no se obtuvo confirmación.
   * ROLLBACK: ocurrió un error previo y no se pudo confirmar la reversión.
   */
  readonly etapa: EtapaTransaccionIncierta;

  /**
   * Error de reversión, cuando existe.
   *
   * La causa principal se conserva por separado en Error.cause.
   */
  readonly errorReversion: unknown;

  constructor(
    etapa: EtapaTransaccionIncierta,
    causa: unknown,
    errorReversion?: unknown,
  ) {
    super(
      etapa === 'COMMIT'
        ? 'No se pudo determinar el resultado de la confirmación de la transacción.'
        : 'No se pudo confirmar la reversión de la transacción.',
      { cause: causa },
    );

    this.name = 'ResultadoTransaccionDesconocidoError';
    this.etapa = etapa;
    this.errorReversion = errorReversion;
  }
}