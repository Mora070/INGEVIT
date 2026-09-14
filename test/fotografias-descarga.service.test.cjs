require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasDescargaService,
} = require('../dist/modules/fotografias/fotografias-descarga.service');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const NOMBRE = '30000000-0000-4000-8000-000000000003.webp';
const CLAVE = `fotografias/${NOMBRE}`;

function comprobarNoDisponible(error) {
  assert.ok(error instanceof NotFoundException);
  assert.equal(error.getStatus(), 404);
  assert.equal(
    error.message,
    'La fotografía no está disponible.',
  );

  return true;
}

test(
  'abrirOptimizada: comprueba el acceso antes de abrir y devuelve el flujo',
  async () => {
    const operaciones = [];
    const flujo = Readable.from([Buffer.from([1, 2, 3])]);

    const repositorio = {
      async buscarOptimizadaDisponible(idProyecto, idUsuario, clave) {
        operaciones.push('consultar');

        assert.equal(idProyecto, ID_PROYECTO);
        assert.equal(idUsuario, ID_USUARIO);
        assert.equal(clave, CLAVE);

        return { s3_key: CLAVE };
      },
    };

    const almacenamiento = {
      async abrirLectura(clave) {
        operaciones.push('abrir');

        assert.equal(clave, CLAVE);
        assert.deepEqual(operaciones, ['consultar', 'abrir']);

        return flujo;
      },
    };

    const servicio = new FotografiasDescargaService(
      repositorio,
      almacenamiento,
    );

    try {
      const resultado = await servicio.abrirOptimizada(
        ID_PROYECTO,
        ID_USUARIO,
        NOMBRE,
      );

      assert.strictEqual(resultado, flujo);

      // El servicio entrega el flujo sin consumirlo ni cerrarlo.
      assert.equal(flujo.readableEnded, false);
      assert.equal(flujo.destroyed, false);
    } finally {
      // El receptor del flujo es responsable de liberar el recurso.
      flujo.destroy();
    }
  },
);

test(
  'abrirOptimizada: no abre almacenamiento cuando la fotografía no está disponible',
  async () => {
    let aperturas = 0;

    const servicio = new FotografiasDescargaService(
      {
        async buscarOptimizadaDisponible() {
          return null;
        },
      },
      {
        async abrirLectura() {
          aperturas += 1;
          throw new Error('No debería abrirse el almacenamiento.');
        },
      },
    );

    await assert.rejects(
      () => servicio.abrirOptimizada(ID_PROYECTO, ID_USUARIO, NOMBRE),
      comprobarNoDisponible,
    );

    assert.equal(aperturas, 0);
  },
);

const nombresInvalidos = [
  ['nombre ausente', undefined],
  ['ruta con directorio superior', `../${NOMBRE}`],
  ['ruta con separador de Windows', `..\\${NOMBRE}`],
  ['extensión del original JPEG', NOMBRE.replace('.webp', '.jpeg')],
  ['salto de línea al final', `${NOMBRE}\n`],
  ['retorno de carro al final', `${NOMBRE}\r`],
];

for (const [descripcion, nombre] of nombresInvalidos) {
  test(
    `abrirOptimizada: rechaza ${descripcion} antes de consultar`,
    async () => {
      let consultas = 0;
      let aperturas = 0;

      const servicio = new FotografiasDescargaService(
        {
          async buscarOptimizadaDisponible() {
            consultas += 1;
            return { s3_key: CLAVE };
          },
        },
        {
          async abrirLectura() {
            aperturas += 1;
            throw new Error('No debería abrirse el almacenamiento.');
          },
        },
      );

      await assert.rejects(
        () => servicio.abrirOptimizada(ID_PROYECTO, ID_USUARIO, nombre),
        comprobarNoDisponible,
      );

      assert.equal(consultas, 0);
      assert.equal(aperturas, 0);
    },
  );
}

test(
  'abrirOptimizada: propaga un error del repositorio sin abrir almacenamiento',
  async () => {
    const errorEsperado = new Error('Fallo simulado de PostgreSQL');
    let aperturas = 0;

    const servicio = new FotografiasDescargaService(
      {
        async buscarOptimizadaDisponible() {
          throw errorEsperado;
        },
      },
      {
        async abrirLectura() {
          aperturas += 1;
        },
      },
    );

    await assert.rejects(
      () => servicio.abrirOptimizada(ID_PROYECTO, ID_USUARIO, NOMBRE),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );

    assert.equal(aperturas, 0);
  },
);

test(
  'abrirOptimizada: propaga un archivo faltante sin convertirlo en HTTP 404',
  async () => {
    const errorEsperado = Object.assign(
      new Error('Archivo ausente en el almacenamiento'),
      { code: 'ENOENT' },
    );

    const servicio = new FotografiasDescargaService(
      {
        async buscarOptimizadaDisponible() {
          return { s3_key: CLAVE };
        },
      },
      {
        async abrirLectura() {
          throw errorEsperado;
        },
      },
    );

    await assert.rejects(
      () => servicio.abrirOptimizada(ID_PROYECTO, ID_USUARIO, NOMBRE),
      (error) => {
        assert.strictEqual(error, errorEsperado);
        return true;
      },
    );
  },
);