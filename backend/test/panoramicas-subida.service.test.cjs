require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  PanoramicasSubidaService,
} = require('../dist/modules/panoramicas/panoramicas-subida.service');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const PANORAMICA = '30000000-0000-4000-8000-000000000001';
const CLAVE = `panoramicas/${PANORAMICA}.png`;

async function crearImagen() {
  // Imagen sintética: prueba el archivo, no una captura 360° real.
  return sharp({
    create: {
      width: 400,
      height: 200,
      channels: 3,
      background: { r: 30, g: 80, b: 120 },
    },
  }).png().toBuffer();
}

function preparar({
  permisos = [true, true],
  errorActividad,
} = {}) {
  const client = {};
  const eventos = [];
  let comprobaciones = 0;
  let contenidoGuardado;

  const service = new PanoramicasSubidaService(
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
      async guardarYRegistrar(contenido, formato, registrar) {
        assert.equal(formato, 'png');
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
          titulo: 'Sector norte',
          url:
            `/api/proyectos/${PROYECTO}/panoramicas/archivos/${PANORAMICA}.png`,
          s3_key: CLAVE,
          mime_type: 'image/png',
        });

        eventos.push('registro');

        return {
          id_panoramica: PANORAMICA,
          ...datos,
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
          tipoAccion: 'PANORAMICA_SUBIDA',
          mensaje: `Panorámica ${PANORAMICA} subida.`,
        });

        eventos.push('actividad');

        if (errorActividad) throw errorActividad;
      },
    },
  );

  return {
    eventos,
    contenidoGuardado: () => contenidoGuardado,
    ejecutar: (contenido) =>
      service.subir(
        PROYECTO, USUARIO, { titulo: 'Sector norte' }, contenido,
      ),
  };
}

test('PanoramicasSubida: utiliza el formato detectado y conserva el original', async () => {
  const escenario = preparar();
  const contenido = await crearImagen();

  const resultado = await escenario.ejecutar(contenido);

  assert.strictEqual(escenario.contenidoGuardado(), contenido);
  assert.equal(resultado.id_usuario_subida, USUARIO);
  assert.equal(resultado.mime_type, 'image/png');
  assert.equal(Object.hasOwn(resultado, 's3_key'), false);
  assert.equal(resultado.fecha_subida, '2026-09-15T12:00:00.000Z');

  assert.deepEqual(escenario.eventos, [
    'acceso', 'archivo', 'acceso', 'registro', 'actividad', 'confirmar',
  ]);
});

test('PanoramicasSubida: rechaza el acceso antes de interpretar la imagen', async () => {
  const { ejecutar, eventos } = preparar({ permisos: [false] });

  await assert.rejects(
    ejecutar(Buffer.from('no es una imagen')),
    (error) => error.getStatus() === 404,
  );

  assert.deepEqual(eventos, ['acceso']);
});

test('PanoramicasSubida: rechaza contenido ilegible antes de almacenarlo', async () => {
  const { ejecutar, eventos } = preparar();

  await assert.rejects(
    ejecutar(Buffer.from('no es una imagen')),
    (error) => error.getStatus() === 400,
  );

  assert.deepEqual(eventos, ['acceso']);
});

test('PanoramicasSubida: vuelve a comprobar el acceso antes de insertar', async () => {
  const { ejecutar, eventos } = preparar({ permisos: [true, false] });

  await assert.rejects(
    ejecutar(await crearImagen()),
    (error) => error.getStatus() === 404,
  );

  assert.deepEqual(eventos, ['acceso', 'archivo', 'acceso']);
});

test('PanoramicasSubida: propaga el fallo del historial sin confirmar', async () => {
  const original = new Error('Falló la actividad');
  const { ejecutar, eventos } = preparar({
    errorActividad: original,
  });

  await assert.rejects(
    ejecutar(await crearImagen()),
    (error) => error === original,
  );

  assert.deepEqual(eventos, [
    'acceso', 'archivo', 'acceso', 'registro', 'actividad',
  ]);
});