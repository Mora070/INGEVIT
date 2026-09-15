require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { UnauthorizedException } = require('@nestjs/common');

const {
  PlanosSubidaController,
} = require('../dist/modules/planos/planos-subida.controller');

const {
  PlanosSubidaService,
} = require('../dist/modules/planos/planos-subida.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

// El servicio está sustituido: aquí comprobamos el transporte de bytes.
const CONTENIDO = Buffer.from('bytes recibidos por multipart');

function formulario({
  archivo = true,
  titulo = 'Plano estructural',
  extra = false,
  campoArchivo = 'archivo',
} = {}) {
  const form = new FormData();

  form.append('titulo', titulo);
  form.append('descripcion', '');

  if (extra) {
    form.append('id_usuario_subida', 'autor-no-permitido');
  }

  if (archivo) {
    form.append(
      campoArchivo,
      new Blob([CONTENIDO], { type: 'application/pdf' }),
      'plano.pdf',
    );
  }

  return form;
}

async function conAplicacion(ejecutar, rechazarSesion = false) {
  const llamadas = [];
  const resultado = {
    id_plano: '40000000-0000-4000-8000-000000000001',
    titulo: 'Plano estructural',
  };

  const modulo = await Test.createTestingModule({
    controllers: [PlanosSubidaController],
    providers: [{
      provide: PlanosSubidaService,
      useValue: {
        async subir(...argumentos) {
          llamadas.push(argumentos);
          return resultado;
        },
      },
    }],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (rechazarSesion) {
          throw new UnauthorizedException();
        }

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
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/planos`,
        {
          method: 'POST',
          body,
        },
      );

    await ejecutar({ enviar, llamadas, resultado });
  } finally {
    await app.close();
  }
}

test('POST planos: entrega los campos y bytes con la identidad de sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas, resultado }) => {
    const respuesta = await enviar(formulario());

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await respuesta.json(), resultado);
    assert.equal(llamadas.length, 1);

    const [proyecto, usuario, datos, contenido] = llamadas[0];

    assert.equal(proyecto, PROYECTO);
    assert.equal(usuario, USUARIO);
    assert.equal(datos.titulo, 'Plano estructural');
    assert.equal(datos.descripcion, '');
    assert.deepEqual(Object.keys(datos).sort(), [
      'descripcion',
      'titulo',
    ]);
    assert.deepEqual(contenido, CONTENIDO);
  });
});

const casosInvalidos = [
  ['archivo ausente', { archivo: false }, PROYECTO],
  ['título vacío', { titulo: '' }, PROYECTO],
  ['autor enviado por el cliente', { extra: true }, PROYECTO],
  ['nombre de campo de archivo incorrecto', {
    campoArchivo: 'documento',
  }, PROYECTO],
  ['proyecto inválido', {}, 'no-es-uuid'],
];

for (const [nombre, opciones, proyecto] of casosInvalidos) {
  test(`POST planos: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(formulario(opciones), proyecto);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('POST planos: rechaza la sesión antes de validar el archivo ausente', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar(formulario({ archivo: false }));
    await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, true);
});