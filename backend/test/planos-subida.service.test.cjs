require('reflect-metadata');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PDFDocument } = require('pdf-lib');

const {
  PlanosSubidaService,
} = require('../dist/modules/planos/planos-subida.service');

const proyecto = '20000000-0000-4000-8000-000000000001';
const usuario = '10000000-0000-4000-8000-000000000001';
const clave = 'planos/30000000-0000-4000-8000-000000000001.pdf';
const datos = { titulo: 'Estructura', descripcion: 'Nivel uno' };

async function crearPdf() {
  const documento = await PDFDocument.create();
  documento.addPage([200, 300]);
  documento.addPage([300, 200]);
  return Buffer.from(await documento.save());
}

/**
 * Simula las dependencias transaccionales.
 * El parser de PDF se ejecuta realmente.
 */
function preparar(permisos = [true, true], errorActividad) {
  const client = {};
  const llamadas = {
    accesos: [],
    guardados: [],
    planos: [],
    actividades: [],
  };

  const service = new PlanosSubidaService(
    {
      async withTransaction(operacion) {
        return operacion(client);
      },
    },
    {
      async bloquearDisponible(conexion, idProyecto, idUsuario) {
        assert.strictEqual(conexion, client);
        llamadas.accesos.push([idProyecto, idUsuario]);
        return permisos[llamadas.accesos.length - 1] ?? false;
      },
    },
    {
      async guardarYRegistrar(contenido, registrar) {
        llamadas.guardados.push(contenido);
        return registrar(client, clave);
      },
    },
    {
      async crear(conexion, entrada) {
        assert.strictEqual(conexion, client);
        llamadas.planos.push(entrada);

        return {
          id_plano: '40000000-0000-4000-8000-000000000001',
          ...entrada,
          mime_type: 'application/pdf',
          fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
        };
      },
    },
    {
      async crear(conexion, entrada) {
        assert.strictEqual(conexion, client);
        llamadas.actividades.push(entrada);

        if (errorActividad) {
          throw errorActividad;
        }
      },
    },
  );

  return { service, llamadas };
}

test('PlanosSubida: registra el PDF y su actividad con la identidad recibida', async () => {
  const { service, llamadas } = preparar();
  const contenido = await crearPdf();

  const resultado = await service.subir(
    proyecto, usuario, datos, contenido,
  );

  assert.deepEqual(llamadas.accesos, [
    [proyecto, usuario],
    [proyecto, usuario],
  ]);
  assert.strictEqual(llamadas.guardados[0], contenido);

  assert.deepEqual(llamadas.planos, [{
    id_proyecto: proyecto,
    id_usuario_subida: usuario,
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    url: `/api/proyectos/${proyecto}/planos/archivos/${clave.slice(7)}`,
    s3_key: clave,
    numero_paginas: 2,
  }]);

  assert.deepEqual(llamadas.actividades, [{
    idProyecto: proyecto,
    idActor: usuario,
    tipoAccion: 'PLANO_SUBIDO',
    mensaje: `Plano ${resultado.id_plano} subido.`,
  }]);

  assert.equal(Object.hasOwn(resultado, 's3_key'), false);
  assert.equal(resultado.fecha_subida, '2026-09-15T12:00:00.000Z');
});

test('PlanosSubida: rechaza el acceso antes de interpretar o guardar', async () => {
  const { service, llamadas } = preparar([false]);

  await assert.rejects(
    service.subir(proyecto, usuario, datos, Buffer.from('no es PDF')),
    (error) => error.getStatus() === 404,
  );

  assert.equal(llamadas.guardados.length, 0);
  assert.equal(llamadas.planos.length, 0);
  assert.equal(llamadas.actividades.length, 0);
});

test('PlanosSubida: rechaza una pérdida de acceso antes de insertar', async () => {
  const { service, llamadas } = preparar([true, false]);

  await assert.rejects(
    service.subir(proyecto, usuario, datos, await crearPdf()),
    (error) => error.getStatus() === 404,
  );

  assert.equal(llamadas.guardados.length, 1);
  assert.equal(llamadas.planos.length, 0);
  assert.equal(llamadas.actividades.length, 0);
});

test('PlanosSubida: propaga el fallo de actividad al coordinador transaccional', async () => {
  const original = new Error('No se pudo registrar la actividad');
  const { service, llamadas } = preparar([true, true], original);

  await assert.rejects(
    service.subir(proyecto, usuario, datos, await crearPdf()),
    (error) => error === original,
  );

  assert.equal(llamadas.planos.length, 1);
  assert.equal(llamadas.actividades.length, 1);
});