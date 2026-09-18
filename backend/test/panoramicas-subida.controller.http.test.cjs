require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { UnauthorizedException } = require('@nestjs/common');

const {
  PanoramicasSubidaController,
} = require('../dist/modules/panoramicas/panoramicas-subida.controller');

const {
  PanoramicasSubidaService,
} = require('../dist/modules/panoramicas/panoramicas-subida.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';
const CONTENIDO = Buffer.from('bytes de prueba de transporte');

function formulario({
  archivo = true,
  titulo = 'Sector norte',
  extra = false,
} = {}) {
  const form = new FormData();
  form.append('titulo', titulo);

  if (extra) form.append('id_usuario_subida', 'otro');

  if (archivo) {
    form.append(
      'archivo',
      new Blob([CONTENIDO], { type: 'image/png' }),
      'panoramica.png',
    );
  }

  return form;
}

/**
 * Aísla el transporte HTTP.
 * El inspector real se prueba por separado y en integración.
 */
async function conAplicacion(ejecutar, sinSesion = false) {
  const llamadas = [];

  const modulo = await Test.createTestingModule({
    controllers: [PanoramicasSubidaController],
    providers: [{
      provide: PanoramicasSubidaService,
      useValue: {
        async subir(...argumentos) {
          llamadas.push(argumentos);
          return { id_panoramica: 'resultado' };
        },
      },
    }],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (sinSesion) throw new UnauthorizedException();

        contexto.switchToHttp().getRequest().usuario = {
          id_usuario: USUARIO,
        };
        return true;
      },
    })
    .compile();

  const app = modulo.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());

  try {
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address();

    const enviar = (body, proyecto = PROYECTO) =>
      fetch(
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/panoramicas`,
        { method: 'POST', body },
      );

    await ejecutar({ enviar, llamadas });
  } finally {
    await app.close();
  }
}

test('POST panorámicas: utiliza la sesión y entrega los bytes recibidos', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar(formulario());

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await respuesta.json(), {
      id_panoramica: 'resultado',
    });

    assert.equal(llamadas.length, 1);
    const [proyecto, usuario, datos, contenido] = llamadas[0];

    assert.equal(proyecto, PROYECTO);
    assert.equal(usuario, USUARIO);
    assert.deepEqual({ ...datos }, { titulo: 'Sector norte' });
    assert.deepEqual(contenido, CONTENIDO);
  });
});

for (const [nombre, opciones, proyecto] of [
  ['archivo ausente', { archivo: false }, PROYECTO],
  ['título vacío', { titulo: '' }, PROYECTO],
  ['autor adicional', { extra: true }, PROYECTO],
  ['proyecto inválido', {}, 'incorrecto'],
]) {
  test(`POST panorámicas: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(formulario(opciones), proyecto);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('POST panorámicas: exige sesión antes de validar el archivo', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar(formulario({ archivo: false }));
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, true);
});