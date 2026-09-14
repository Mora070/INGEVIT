require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { NotFoundException } = require('@nestjs/common');

const {
  FotografiasEdicionController,
} = require('../dist/modules/fotografias/fotografias-edicion.controller');

const {
  FotografiasEdicionService,
} = require('../dist/modules/fotografias/fotografias-edicion.service');

const {
  AuthGuard,
} = require('../dist/modules/auth/guards/auth.guard');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_FOTOGRAFIA = '30000000-0000-4000-8000-000000000003';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

/**
 * Prueba el controlador por HTTP con la validación real.
 *
 * Sustituye el servicio y el guard para aislar el transporte.
 * La autenticación y la protección de origen reales se comprobarán
 * con la aplicación completa.
 */
async function conAplicacion(ejecutar, opciones = {}) {
  const llamadas = [];

  const fotografia = {
    id_fotografia: ID_FOTOGRAFIA,
    id_proyecto: ID_PROYECTO,
    titulo: 'Título actualizado',
    url: '/fotografia.webp',
  };

  const modulo = await Test.createTestingModule({
    controllers: [FotografiasEdicionController],
    providers: [
      {
        provide: FotografiasEdicionService,
        useValue: {
          async actualizarTitulo(...argumentos) {
            llamadas.push(argumentos);

            if (opciones.errorServicio) {
              throw opciones.errorServicio;
            }

            return fotografia;
          },
        },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(contexto) {
        if (!opciones.sinIdentidad) {
          contexto.switchToHttp().getRequest().usuario = {
            id_usuario: ID_USUARIO,
          };
        }

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

    const direccion = app.getHttpServer().address();
    const base = `http://127.0.0.1:${direccion.port}/api/proyectos`;

    const enviar = (
      datos,
      idProyecto = ID_PROYECTO,
      idFotografia = ID_FOTOGRAFIA,
    ) =>
      fetch(
        `${base}/${idProyecto}/fotografias/${idFotografia}/titulo`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );

    await ejecutar({ enviar, llamadas, fotografia });
  } finally {
    await app.close();
  }
}

test(
  'PATCH título: utiliza la sesión y devuelve los metadatos actualizados',
  async () => {
    await conAplicacion(async ({ enviar, llamadas, fotografia }) => {
      const respuesta = await enviar({
        titulo: 'Título actualizado',
      });

      const cuerpo = await respuesta.json();

      assert.equal(respuesta.status, 200);
      assert.equal(
        respuesta.headers.get('cache-control'),
        'no-store',
      );
      assert.deepEqual(cuerpo, fotografia);
      assert.equal(llamadas.length, 1);

      const [idProyecto, idFotografia, idUsuario, datos] = llamadas[0];

      assert.equal(idProyecto, ID_PROYECTO);
      assert.equal(idFotografia, ID_FOTOGRAFIA);
      assert.equal(idUsuario, ID_USUARIO);
      assert.equal(datos.titulo, 'Título actualizado');
      assert.deepEqual(Object.keys(datos), ['titulo']);
    });
  },
);

const entradasInvalidas = [
  [
    'proyecto inválido',
    { titulo: 'Nuevo título' },
    'no-es-uuid',
    ID_FOTOGRAFIA,
  ],
  [
    'fotografía inválida',
    { titulo: 'Nuevo título' },
    ID_PROYECTO,
    'no-es-uuid',
  ],
  [
    'título ausente',
    {},
    ID_PROYECTO,
    ID_FOTOGRAFIA,
  ],
  [
    'título vacío',
    { titulo: '' },
    ID_PROYECTO,
    ID_FOTOGRAFIA,
  ],
  [
    'campo adicional',
    {
      titulo: 'Nuevo título',
      id_usuario_subida: ID_USUARIO,
    },
    ID_PROYECTO,
    ID_FOTOGRAFIA,
  ],
];

for (const [descripcion, datos, proyecto, fotografia] of entradasInvalidas) {
  test(
    `PATCH título: rechaza ${descripcion} antes de ejecutar el servicio`,
    async () => {
      await conAplicacion(async ({ enviar, llamadas }) => {
        const respuesta = await enviar(datos, proyecto, fotografia);
        await respuesta.json();

        assert.equal(respuesta.status, 400);
        assert.equal(llamadas.length, 0);
      });
    },
  );
}

test(
  'PATCH título: la comprobación defensiva rechaza una identidad ausente',
  async () => {
    await conAplicacion(
      async ({ enviar, llamadas }) => {
        const respuesta = await enviar({
          titulo: 'Nuevo título',
        });

        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 401);
        assert.equal(
          cuerpo.message,
          'La sesión no es válida o ha expirado.',
        );
        assert.equal(llamadas.length, 0);
      },
      { sinIdentidad: true },
    );
  },
);

test(
  'PATCH título: conserva el rechazo del servicio para una fotografía no disponible',
  async () => {
    await conAplicacion(
      async ({ enviar, llamadas }) => {
        const respuesta = await enviar({
          titulo: 'Nuevo título',
        });

        const cuerpo = await respuesta.json();

        assert.equal(respuesta.status, 404);
        assert.equal(
          cuerpo.message,
          'La fotografía no está disponible.',
        );
        assert.equal(llamadas.length, 1);
      },
      {
        errorServicio: new NotFoundException(
          'La fotografía no está disponible.',
        ),
      },
    );
  },
);