require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const {
  NotFoundException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  PlanosEdicionController,
} = require('../dist/modules/planos/planos-edicion.controller');

const {
  PlanosEdicionService,
} = require('../dist/modules/planos/planos-edicion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const PROYECTO = '20000000-0000-4000-8000-000000000001';
const PLANO = '30000000-0000-4000-8000-000000000001';
const USUARIO = '10000000-0000-4000-8000-000000000001';

async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];
  const resultado = {
    id_plano: PLANO,
    titulo: 'Nuevo título',
    descripcion: '',
  };

  const modulo = await Test.createTestingModule({
    controllers: [PlanosEdicionController],
    providers: [{
      provide: PlanosEdicionService,
      useValue: {
        async actualizarDatos(...argumentos) {
          llamadas.push(argumentos);

          if (opciones.errorServicio) {
            throw opciones.errorServicio;
          }

          return resultado;
        },
      },
    }],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (opciones.sinSesion) {
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

    const enviar = (
      datos,
      proyecto = PROYECTO,
      plano = PLANO,
    ) =>
      fetch(
        `http://127.0.0.1:${port}/api/proyectos/${proyecto}/planos/${plano}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );

    await ejecutar({ enviar, llamadas, resultado });
  } finally {
    await app.close();
  }
}

test('PATCH planos: entrega ambos campos y utiliza la identidad de sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas, resultado }) => {
    const respuesta = await enviar({
      titulo: 'Nuevo título',
      descripcion: '',
    });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await respuesta.json(), resultado);
    assert.equal(llamadas.length, 1);

    const [proyecto, plano, usuario, datos] = llamadas[0];

    assert.equal(proyecto, PROYECTO);
    assert.equal(plano, PLANO);
    assert.equal(usuario, USUARIO);
    assert.deepEqual({ ...datos }, {
      titulo: 'Nuevo título',
      descripcion: '',
    });
  });
});

const casosInvalidos = [
  ['título ausente', { descripcion: '' }],
  ['título vacío', { titulo: '', descripcion: '' }],
  ['descripción ausente', { titulo: 'Plano' }],
  ['descripción nula', { titulo: 'Plano', descripcion: null }],
  ['autor adicional', {
    titulo: 'Plano',
    descripcion: '',
    id_usuario_subida: USUARIO,
  }],
  ['proyecto inválido', {
    titulo: 'Plano',
    descripcion: '',
  }, 'incorrecto', PLANO],
  ['plano inválido', {
    titulo: 'Plano',
    descripcion: '',
  }, PROYECTO, 'incorrecto'],
];

for (const [nombre, datos, proyecto, plano] of casosInvalidos) {
  test(`PATCH planos: rechaza ${nombre}`, async () => {
    await conAplicacion(async ({ enviar, llamadas }) => {
      const respuesta = await enviar(datos, proyecto, plano);
      await respuesta.json();

      assert.equal(respuesta.status, 400);
      assert.equal(llamadas.length, 0);
    });
  });
}

test('PATCH planos: rechaza solicitudes sin sesión', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar({
      titulo: 'Plano',
      descripcion: '',
    });

    await respuesta.json();
    assert.equal(respuesta.status, 401);
    assert.equal(llamadas.length, 0);
  }, { sinSesion: true });
});

test('PATCH planos: conserva el rechazo de acceso del servicio', async () => {
  await conAplicacion(async ({ enviar, llamadas }) => {
    const respuesta = await enviar({
      titulo: 'Plano',
      descripcion: '',
    });

    const cuerpo = await respuesta.json();

    assert.equal(respuesta.status, 404);
    assert.equal(cuerpo.message, 'El proyecto no está disponible.');
    assert.equal(llamadas.length, 1);
  }, {
    errorServicio: new NotFoundException(
      'El proyecto no está disponible.',
    ),
  });
});