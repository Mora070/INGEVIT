require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  PlanosSubidaService,
} = require('../dist/modules/planos/planos-subida.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const CLAVE = `planos/${PLANO}.pdf`;

/**
 * Encabezado PDF mínimo válido para superar la validación de inspeccionarPlano.
 */
function crearPdfValido() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
    '0000000052 00000 n\n0000000102 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF',
  );
}

function preparar({
  permisos = [true, true],
  errorActividad,
} = {}) {
  const client = {};
  const eventos = [];
  let comprobaciones = 0;
  let contenidoGuardado;

  const service = new PlanosSubidaService(
    {
      async withTransaction(operacion) {
        return operacion(client);
      },
    },
    {
      async bloquearDisponible(conexion, proyecto, usuario) {
        assert.strictEqual(conexion, client);
        assert.deepEqual([proyecto, usuario], [PROYECTO, USUARIO]);
        eventos.push('acceso');
        return permisos[comprobaciones++] ?? false;
      },
    },
    {
      async guardarYRegistrar(contenido, registrar) {
        contenidoGuardado = contenido;
        eventos.push('archivo');
        const resultado = await registrar(client, CLAVE);
        eventos.push('confirmar');
        return resultado;
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          id_proyecto: PROYECTO,
          id_usuario_subida: USUARIO,
          titulo: 'Estructuras',
          descripcion: 'Plano estructural principal',
          url: `/api/proyectos/${PROYECTO}/planos/archivos/${PLANO}.pdf`,
          s3_key: CLAVE,
          numero_paginas: 1,
        });

        eventos.push('registro');

        return {
          id_plano: PLANO,
          ...datos,
          mime_type: 'application/pdf',
          fecha_subida: new Date('2026-09-15T12:00:00.000Z'),
        };
      },
    },
    {
      async crear(conexion, datos) {
        assert.strictEqual(conexion, client);
        assert.deepEqual(datos, {
          idProyecto: PROYECTO,
          idActor: USUARIO,
          tipoAccion: 'PLANO_SUBIDO',
          mensaje: `Plano ${PLANO} subido.`,
        });

        eventos.push('actividad');

        if (errorActividad) throw errorActividad;
      },
    },
    {
      async crearParaParticipantesProyecto(conexion) {
        assert.strictEqual(conexion, client);
        eventos.push('notificacion');
      },
    },
  );

  return {
    eventos,
    contenidoGuardado: () => contenidoGuardado,
    ejecutar: (contenido = crearPdfValido()) =>
      service.subir(
        PROYECTO, USUARIO, {
          titulo: 'Estructuras',
          descripcion: 'Plano estructural principal',
        }, contenido,
      ),
  };
}

test('PlanosSubida: registra el PDF y su actividad con la identidad recibida', async () => {
  const escenario = preparar();
  const contenido = crearPdfValido();

  const resultado = await escenario.ejecutar(contenido);

  assert.strictEqual(escenario.contenidoGuardado(), contenido);
  assert.equal(resultado.id_usuario_subida, USUARIO);
  assert.equal(Object.hasOwn(resultado, 's3_key'), false);
  assert.equal(resultado.fecha_subida, '2026-09-15T12:00:00.000Z');

  assert.deepEqual(escenario.eventos, [
    'acceso',
    'archivo',
    'acceso',
    'registro',
    'actividad',
    'notificacion',
    'confirmar',
  ]);
});

test('PlanosSubida: rechaza el acceso antes de analizar el PDF', async () => {
  const { ejecutar, eventos } = preparar({ permisos: [false] });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso']);
});

test('PlanosSubida: vuelve a comprobar el acceso antes de insertar', async () => {
  const { ejecutar, eventos } = preparar({ permisos: [true, false] });

  await assert.rejects(ejecutar(), (error) => error.getStatus() === 404);
  assert.deepEqual(eventos, ['acceso', 'archivo', 'acceso']);
});

test('PlanosSubida: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(ejecutar(), (error) => error === original);
  assert.deepEqual(eventos, [
    'acceso',
    'archivo',
    'acceso',
    'registro',
    'actividad',
  ]);
});