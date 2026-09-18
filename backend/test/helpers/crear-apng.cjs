const { deflateSync } = require('node:zlib');

const FIRMA_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function calcularCrc32(datos) {
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crearBloque(tipo, datos = Buffer.alloc(0)) {
  const tipoBuffer = Buffer.from(tipo, 'ascii');
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(calcularCrc32(Buffer.concat([tipoBuffer, datos])));
  return Buffer.concat([longitud, tipoBuffer, datos, crc]);
}

function crearCabecera() {
  const datos = Buffer.alloc(13);
  datos.writeUInt32BE(1, 0); // ancho
  datos.writeUInt32BE(1, 4); // alto
  datos[8] = 8;              // bits por canal
  datos[9] = 6;              // RGBA
  return crearBloque('IHDR', datos);
}

function comprimirPixel(rojo, verde, azul) {
  return deflateSync(Buffer.from([0, rojo, verde, azul, 255]));
}

function crearControlFotograma(secuencia) {
  const datos = Buffer.alloc(26);
  datos.writeUInt32BE(secuencia, 0);
  datos.writeUInt32BE(1, 4); // ancho
  datos.writeUInt32BE(1, 8); // alto
  datos.writeUInt16BE(1, 20);
  datos.writeUInt16BE(10, 22); // duración
  return crearBloque('fcTL', datos);
}

function crearApngDosFotogramas() {
  const controlAnimacion = Buffer.alloc(8);
  controlAnimacion.writeUInt32BE(2, 0);
  controlAnimacion.writeUInt32BE(0, 4); // repetición indefinida

  const secuenciaSegundoFotograma = Buffer.alloc(4);
  secuenciaSegundoFotograma.writeUInt32BE(2);

  return Buffer.concat([
    FIRMA_PNG,
    crearCabecera(),
    crearBloque('acTL', controlAnimacion),
    crearControlFotograma(0),
    crearBloque('IDAT', comprimirPixel(255, 0, 0)),
    crearControlFotograma(1),
    crearBloque('fdAT', Buffer.concat([secuenciaSegundoFotograma, comprimirPixel(0, 0, 255)])),
    crearBloque('IEND'),
  ]);
}

module.exports = { crearApngDosFotogramas };
