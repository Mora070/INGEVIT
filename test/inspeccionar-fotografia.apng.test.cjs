require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
const sharp = require('sharp');
const { BadRequestException } = require('@nestjs/common');

const {
  inspeccionarFotografia,
} = require('../dist/modules/fotografias/utils/inspeccionar-fotografia');

const FIRMA_PNG = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
]);

const {
  leerFotogramasPng,
} = require('../dist/modules/fotografias/utils/leer-fotogramas-png');

/**
 * Calcula el CRC utilizado por los bloques PNG.
 * Esta función solo construye los archivos de prueba.
 */
function calcularCrc32(datos) {
  let crc = 0xffffffff;

  for (const byte of datos) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (
        (crc & 1) ? 0xedb88320 : 0
      );
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Construye un bloque PNG completo:
 * longitud + tipo + datos + CRC.
 */
function crearBloque(tipo, datos = Buffer.alloc(0)) {
  const tipoBuffer = Buffer.from(tipo, 'ascii');

  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(
    calcularCrc32(Buffer.concat([tipoBuffer, datos])),
  );

  return Buffer.concat([
    longitud,
    tipoBuffer,
    datos,
    crc,
  ]);
}

function crearCabecera() {
  const datos = Buffer.alloc(13);

  datos.writeUInt32BE(1, 0); // Ancho: un píxel.
  datos.writeUInt32BE(1, 4); // Alto: un píxel.
  datos[8] = 8;             // Ocho bits por canal.
  datos[9] = 6;             // Color RGBA.

  return crearBloque('IHDR', datos);
}

/**
 * Codifica una fila de un píxel RGBA.
 * El primer byte indica que no se aplica filtro PNG.
 */
function comprimirPixel(rojo, verde, azul) {
  return deflateSync(
    Buffer.from([0, rojo, verde, azul, 255]),
  );
}

function crearControlFotograma(secuencia) {
  const datos = Buffer.alloc(26);

  datos.writeUInt32BE(secuencia, 0);
  datos.writeUInt32BE(1, 4);  // Ancho.
  datos.writeUInt32BE(1, 8);  // Alto.
  // Desplazamientos X e Y: cero.
  datos.writeUInt16BE(1, 20);
  datos.writeUInt16BE(10, 22); // Duración: 1/10 de segundo.
  // Eliminación y mezcla: cero.

  return crearBloque('fcTL', datos);
}

function crearApngDosFotogramas() {
  const controlAnimacion = Buffer.alloc(8);
  controlAnimacion.writeUInt32BE(2, 0);
  controlAnimacion.writeUInt32BE(0, 4); // Repetición indefinida.

  const secuenciaSegundoFotograma = Buffer.alloc(4);
  secuenciaSegundoFotograma.writeUInt32BE(2);

  return Buffer.concat([
    FIRMA_PNG,
    crearCabecera(),
    crearBloque('acTL', controlAnimacion),

    // Primer fotograma: rojo, incluido como imagen PNG principal.
    crearControlFotograma(0),
    crearBloque('IDAT', comprimirPixel(255, 0, 0)),

    // Segundo fotograma: azul.
    crearControlFotograma(1),
    crearBloque(
      'fdAT',
      Buffer.concat([
        secuenciaSegundoFotograma,
        comprimirPixel(0, 0, 255),
      ]),
    ),

    crearBloque('IEND'),
  ]);
}

test(
  'inspeccionarFotografia: rechaza un APNG de dos fotogramas sin modificarlo',
  async () => {
    const contenido = crearApngDosFotogramas();
    const copia = Buffer.from(contenido);

    /*
     * Comprobamos que la imagen principal se puede decodificar.
     * El archivo no debe ser rechazado simplemente por ser ilegible.
     */
    const imagen = await sharp(contenido)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    assert.equal(imagen.info.width, 1);
    assert.equal(imagen.info.height, 1);
    assert.deepEqual(imagen.data, Buffer.from([255, 0, 0, 255]));

    await assert.rejects(
      () => inspeccionarFotografia(contenido),
      (error) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'Solo se aceptan fotografías estáticas.',
        );

        return true;
      },
    );

    assert.deepEqual(contenido, copia);
  },
);

test(
  'inspeccionarFotografia: acepta un PNG estático con el texto acTL en sus metadatos',
  async () => {
    const contenido = Buffer.concat([
      FIRMA_PNG,
      crearCabecera(),

      /*
       * El texto acTL está dentro de un comentario.
       * No es un bloque de control de animación.
       */
      crearBloque(
        'tEXt',
        Buffer.from('Comentario\0Este texto menciona acTL.', 'latin1'),
      ),

      crearBloque('IDAT', comprimirPixel(0, 255, 0)),
      crearBloque('IEND'),
    ]);

    const copia = Buffer.from(contenido);
    const resultado = await inspeccionarFotografia(contenido);

    assert.equal(resultado.formato, 'png');
    assert.equal(resultado.fotogramas, 1);
    assert.equal(resultado.ancho, 1);
    assert.equal(resultado.alto, 1);
    assert.deepEqual(contenido, copia);
  },
);


test(
  'inspeccionarFotografia: permite un APNG de un solo fotograma',
  async () => {
    const control = Buffer.alloc(8);
    control.writeUInt32BE(1, 0);

    const contenido = Buffer.concat([
      FIRMA_PNG,
      crearCabecera(),
      crearBloque('acTL', control),
      crearControlFotograma(0),
      crearBloque('IDAT', comprimirPixel(255, 0, 0)),
      crearBloque('IEND'),
    ]);

    const resultado = await inspeccionarFotografia(contenido);

    assert.equal(resultado.formato, 'png');
    assert.equal(resultado.fotogramas, 1);
  },
);

/**
 * Los archivos estructuralmente inválidos deben producir un error
 * controlado, sin exponer errores de lectura de Buffer.
 */
function comprobarPngInvalido(contenido) {
  assert.throws(
    () => leerFotogramasPng(contenido),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'No se pudo interpretar la fotografía recibida.',
      );

      return true;
    },
  );
}

test(
  'leerFotogramasPng: rechaza un bloque cuya longitud supera los bytes disponibles',
  () => {
    /*
     * El encabezado anuncia ocho bytes de datos,
     * pero el archivo termina antes de incluirlos.
     */
    const encabezado = Buffer.alloc(8);
    encabezado.writeUInt32BE(8, 0);
    encabezado.write('acTL', 4, 'ascii');

    comprobarPngInvalido(
      Buffer.concat([
        FIRMA_PNG,
        crearCabecera(),
        encabezado,
        Buffer.alloc(4),
      ]),
    );
  },
);

test(
  'leerFotogramasPng: rechaza un control que declara cero fotogramas',
  () => {
    comprobarPngInvalido(
      Buffer.concat([
        FIRMA_PNG,
        crearCabecera(),
        crearBloque('acTL', Buffer.alloc(8)),
        crearBloque('IDAT', comprimirPixel(255, 0, 0)),
        crearBloque('IEND'),
      ]),
    );
  },
);

test(
  'leerFotogramasPng: rechaza controles de animación duplicados',
  () => {
    const control = Buffer.alloc(8);
    control.writeUInt32BE(1, 0);

    comprobarPngInvalido(
      Buffer.concat([
        FIRMA_PNG,
        crearCabecera(),
        crearBloque('acTL', control),
        crearBloque('acTL', control),
        crearBloque('IDAT', comprimirPixel(255, 0, 0)),
        crearBloque('IEND'),
      ]),
    );
  },
);