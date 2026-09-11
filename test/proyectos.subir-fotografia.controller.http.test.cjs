require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');

const {
  ProyectosController,
} = require('../dist/modules/proyectos/proyectos.controller');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const {
  ActividadesService,
} = require('../dist/modules/actividades/actividades.service');

const {
  FotografiasService,
} = require('../dist/modules/fotografias/fotografias.service');

const {
  FotografiasSubidaService,
} = require('../dist/modules/fotografias/fotografias-subida.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  MAX_BYTES_FOTOGRAFIA_ORIGINAL,
} = require('../dist/modules/fotografias/config/procesamiento-fotografia.config');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Inicia una aplicación HTTP aislada en un puerto disponible.
 *
 * La autenticación se sustituye para concentrar estas pruebas
 * en la recepción multipart y la validación de entrada.
 *
 * El servicio de subida también se sustituye: no se procesan
 * imágenes ni se escriben archivos o registros.
 */
async function conAplicacion(ejecutar) {
  const llamadas = [];

  const respuesta = {
    id_fotografia: '30000000-0000-4000-8000-000000000003',
    titulo: 'Avance de obra',
    url: '/fotografia-optimizada-de-prueba.webp',
  };

  const modulo = await Test.createTestingModule({
    controllers: [ProyectosController],
    providers: [
      { provide: ProyectosService, useValue: {} },
      { provide: ActividadesService, useValue: {} },
      { provide: FotografiasService, useValue: {} },
      {
        provide: FotografiasSubidaService,
        useValue: {
          async subir(...argumentos) {
            llamadas.push(argumentos);
            return respuesta;
          },
        },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        const request = contexto.switchToHttp().getRequest();
        request.usuario = { id_usuario: ID_USUARIO };
        return true;
      },
    })
    .compile();

  const app = modulo.createNestApplication();
  app.useLogger(false);
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  try {
    await app.listen(0, '127.0.0.1');

    const direccion = app.getHttpServer().address();
    const url =
      `http://127.0.0.1:${direccion.port}` +
      `/api/proyectos/${ID_PROYECTO}/fotografias`;

    await ejecutar({ url, llamadas, respuesta });
  } finally {
    await app.close();
  }
}

/**
 * El contenido puede ser arbitrario porque la interpretación
 * de la imagen corresponde al servicio, sustituido en esta suite.
 */
function crearFormulario(contenido = Buffer.from([1, 2, 3])) {
  const formulario = new FormData();

  formulario.append('titulo', 'Avance de obra');
  formulario.append(
    'archivo',
    new Blob([contenido], { type: 'image/jpeg' }),
    'fotografia.jpg',
  );

  return formulario;
}

test('POST fotografía: recibe el archivo y devuelve HTTP 201', async () => {
  await conAplicacion(async ({ url, llamadas, respuesta }) => {
    const contenido = Buffer.from([0, 10, 127, 128, 255]);

    const resultado = await fetch(url, {
      method: 'POST',
      body: crearFormulario(contenido),
    });

    const cuerpo = await resultado.json();

    assert.equal(resultado.status, 201);
    assert.equal(resultado.headers.get('cache-control'), 'no-store');
    assert.deepEqual(cuerpo, respuesta);

    assert.equal(llamadas.length, 1);

    const [idProyecto, idUsuario, datos, buffer] = llamadas[0];

    assert.equal(idProyecto, ID_PROYECTO);
    assert.equal(idUsuario, ID_USUARIO);
    assert.equal(datos.titulo, 'Avance de obra');
    assert.ok(Buffer.isBuffer(buffer));
    assert.deepEqual(buffer, contenido);
  });
});

test('POST fotografía: rechaza una petición sin archivo', async () => {
  await conAplicacion(async ({ url, llamadas }) => {
    const formulario = new FormData();
    formulario.append('titulo', 'Avance de obra');

    const resultado = await fetch(url, {
      method: 'POST',
      body: formulario,
    });

    const cuerpo = await resultado.json();

    assert.equal(resultado.status, 400);
    assert.equal(
      cuerpo.message,
      'Debes proporcionar un archivo de fotografía no vacío.',
    );
    assert.equal(llamadas.length, 0);
  });
});

test('POST fotografía: rechaza un título ausente', async () => {
  await conAplicacion(async ({ url, llamadas }) => {
    const formulario = crearFormulario();
    formulario.delete('titulo');

    const resultado = await fetch(url, {
      method: 'POST',
      body: formulario,
    });

    await resultado.json();

    assert.equal(resultado.status, 400);
    assert.equal(llamadas.length, 0);
  });
});

test('POST fotografía: rechaza una identidad enviada en el formulario', async () => {
  await conAplicacion(async ({ url, llamadas }) => {
    const formulario = crearFormulario();

    formulario.append(
      'id_usuario_subida',
      '40000000-0000-4000-8000-000000000004',
    );

    const resultado = await fetch(url, {
      method: 'POST',
      body: formulario,
    });

    await resultado.json();

    assert.equal(resultado.status, 400);
    assert.equal(llamadas.length, 0);
  });
});

test('POST fotografía: rechaza un archivo superior a 20 MiB', async () => {
  await conAplicacion(async ({ url, llamadas }) => {
    // Superamos el límite por un byte.
    const contenido = Buffer.alloc(MAX_BYTES_FOTOGRAFIA_ORIGINAL + 1);

    const resultado = await fetch(url, {
      method: 'POST',
      body: crearFormulario(contenido),
    });

    await resultado.json();

    assert.equal(resultado.status, 413);
    assert.equal(llamadas.length, 0);
  });
});