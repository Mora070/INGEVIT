import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
export const MAX_ARCHIVO_CARPETA = 50 * 1024 * 1024;
const MIME = {pdf:'application/pdf', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dwg:'application/acad'};
// Inspección del directorio ZIP sin descomprimir contenido no confiable.
function esLibroXlsx(b: Buffer): boolean {
  for (let p = b.length - 22; p >= Math.max(0,b.length - 65557); p--) {
    if (b.readUInt32LE(p) !== 0x06054b50 || p + 22 + b.readUInt16LE(p+20) !== b.length) continue;
    const fin = b.readUInt32LE(p+16) + b.readUInt32LE(p+12);
    let pos = b.readUInt32LE(p+16);
    if (fin > p || fin < pos) return false;
    const nombres = new Set<string>();
    for (let n=0; n<b.readUInt16LE(p+10); n++) {
      if (pos+46>fin || b.readUInt32LE(pos)!==0x02014b50) return false;
      const len=b.readUInt16LE(pos+28);
      const siguiente=pos+46+len+b.readUInt16LE(pos+30)+b.readUInt16LE(pos+32);
      if(siguiente>fin) return false;
      nombres.add(b.subarray(pos+46,pos+46+len).toString('utf8'));
      pos=siguiente;
    }
    return nombres.has('[Content_Types].xml') && nombres.has('xl/workbook.xml');
  }
  return false;
}
export function validarArchivoCarpeta(archivo?: Express.Multer.File) {
  if (!archivo?.buffer?.length || archivo.buffer.length > MAX_ARCHIVO_CARPETA) throw new BadRequestException('Selecciona un archivo de hasta 50 MB.');
  const nombre = archivo.originalname.replace(/.*[\\/]/, '').replace(/[\x00-\x1f\x7f]/g, '').trim();
  const extension = extname(nombre).slice(1).toLowerCase() as keyof typeof MIME;
  if (!nombre || nombre.length>255 || !Object.hasOwn(MIME,extension)) throw new BadRequestException('Formatos permitidos: PDF, XLS, XLSX y DWG.');
  const b=archivo.buffer;
  const valido = extension==='pdf' ? b.subarray(0,1024).includes(Buffer.from('%PDF-'))
    : extension==='dwg' ? /^AC10[0-9]{2}$/.test(b.subarray(0,6).toString('ascii'))
    : extension==='xls' ? b.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex')) && (b.includes(Buffer.from('Workbook','utf16le')) || b.includes(Buffer.from('Book','utf16le')))
    : esLibroXlsx(b);
  if (!valido) throw new BadRequestException('El contenido del archivo no corresponde a su extensión.');
  return {nombre,extension,mime_type:MIME[extension],tamano:b.length};
}
