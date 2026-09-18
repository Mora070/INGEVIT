require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PDFDocument,
  EncryptedPDFError,
} = require('pdf-lib');

const {
  inspeccionarPlano,
} = require('../dist/modules/planos/utils/inspeccionar-plano');

const {
  MAX_BYTES_PLANO,
} = require('../dist/modules/planos/config/subida-plano.config');

/**
 * Genera documentos de prueba en memoria.
 * La aplicación no usa save() al inspeccionar archivos recibidos.
 */
async function crearPdf(numeroPaginas) {
  const documento = await PDFDocument.create();

  for (let i = 0; i < numeroPaginas; i += 1) {
    documento.addPage([200, 300]);
  }

  return Buffer.from(
    await documento.save({ addDefaultPage: false }),
  );
}

test(
  'inspeccionarPlano: obtiene las páginas sin modificar el original',
  async () => {
    const contenido = await crearPdf(2);
    const copia = Buffer.from(contenido);

    assert.deepEqual(
      await inspeccionarPlano(contenido),
      {
        bytes: contenido.length,
        numeroPaginas: 2,
        mimeType: 'application/pdf',
      },
    );

    assert.deepEqual(contenido, copia);
  },
);

test('inspeccionarPlano: rechaza un archivo vacío', async () => {
  await assert.rejects(
    () => inspeccionarPlano(Buffer.alloc(0)),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'Debes proporcionar un archivo de plano no vacío.',
      );
      return true;
    },
  );
});

test('inspeccionarPlano: rechaza contenido que no es PDF', async () => {
  await assert.rejects(
    () => inspeccionarPlano(Buffer.from('Esto no es un PDF.')),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'No se pudo interpretar el archivo como un PDF válido.',
      );
      return true;
    },
  );
});

test(
  'inspeccionarPlano: rechaza archivos mayores de 35 MiB antes de interpretarlos',
  async () => {
    await assert.rejects(
      () => inspeccionarPlano(Buffer.alloc(MAX_BYTES_PLANO + 1)),
      (error) => {
        assert.equal(error.getStatus(), 413);
        assert.equal(error.message, 'El plano no puede superar 35 MiB.');
        return true;
      },
    );
  },
);

test('inspeccionarPlano: rechaza un documento sin páginas', async () => {
  const contenido = await crearPdf(0);

  await assert.rejects(
    () => inspeccionarPlano(contenido),
    (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(
        error.message,
        'El plano PDF debe contener al menos una página.',
      );
      return true;
    },
  );
});

test(
  'inspeccionarPlano: traduce el error de cifrado sin intentar ignorarlo',
  async (t) => {
    /*
     * Esta prueba verifica el tratamiento del error de la biblioteca.
     * No representa una prueba con un PDF cifrado real.
     */
    t.mock.method(PDFDocument, 'load', async (_contenido, opciones) => {
      assert.equal(opciones.ignoreEncryption, false);
      throw new EncryptedPDFError();
    });

    await assert.rejects(
      () => inspeccionarPlano(Buffer.from('%PDF-1.7')),
      (error) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(
          error.message,
          'No se admiten planos PDF cifrados en esta implementación.',
        );
        return true;
      },
    );
  },
);