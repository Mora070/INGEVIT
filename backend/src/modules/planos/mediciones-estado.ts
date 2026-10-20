import { BadRequestException } from '@nestjs/common';

const unidades = ['', 'm', 'cm', 'mm', 'm-and-cm', 'decimal-ft', 'ft', 'ft-and-decimal-in', 'decimal-in', 'fractional-in', 'pt'];
function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function validarEstadoMediciones(estado: Record<string, unknown>): void {
  const invalido = () => { throw new BadRequestException('El estado de las mediciones no es válido.'); };
  if (Buffer.byteLength(JSON.stringify(estado), 'utf8') > 512_000) invalido();
  if (estado.schema !== 1 || !Array.isArray(estado.mediciones) || estado.mediciones.length > 500) return invalido();
  if (typeof estado.unidades !== 'string' || !unidades.includes(estado.unidades)) invalido();
  if (!Number.isInteger(estado.precision) || Number(estado.precision) < 0 || Number(estado.precision) > 6) invalido();
  if (estado.calibracion !== null) {
    if (!objeto(estado.calibracion) || typeof estado.calibracion.factor !== 'number' || !Number.isFinite(estado.calibracion.factor) || estado.calibracion.factor <= 0) return invalido();
    if (typeof estado.calibracion.unidades !== 'string' || !unidades.includes(estado.calibracion.unidades)) invalido();
  }
  for (const medida of estado.mediciones) {
    if (!objeto(medida) || !['Distance', 'Angle', 'Area'].includes(String(medida.type))) return invalido();
    const minimo = medida.type === 'Distance' ? 2 : 3;
    if (!Array.isArray(medida.picks) || medida.picks.length < minimo || medida.picks.length > 1000) return invalido();
    for (const pick of medida.picks) {
      if (!objeto(pick) || !objeto(pick.intersection)) return invalido();
      for (const eje of ['x', 'y', 'z']) {
        const valor = pick.intersection[eje];
        if (typeof valor !== 'number' || !Number.isFinite(valor) || Math.abs(valor) > 1e12) invalido();
      }
    }
  }
}
