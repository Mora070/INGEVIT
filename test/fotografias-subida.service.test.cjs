require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
  FotografiasSubidaService,
} = require(
  '../dist/modules/fotografias/fotografias-subida.service',
);

const ID_PROYECTO = '20000000-0000-4000-8000-000000000002';
const ID_USUARIO = '10000000-0000-4000-8000-000000000001';
const ID_FOTOGRAFIA = '70000000-0000-4000-8000-000000000007';

const CLAVES = {
  original_s3_key:
    'fotografias/60000000-0000-4000-8000-000000000006.jpeg',
  s3_key:
    'fotografias/50000000-0000-4000-8000-000000000005.webp',
};

async function crearOriginal() {
  return sharp({
    create: {
      width: 32,
      height: 16,
      channels: 3,
      background: { r: 30, g: 100, b: 180 },
    },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Simula persistencia y repositorios, pero utiliza el procesamiento real.
 *
 * No escribe archivos ni consulta PostgreSQL.
 * Los clientes distintos comprueban que la transacción inicial termina
 * antes de comenzar la operación de registro.
 */
function crearEscenario({
  accesoInicial = true,
  accesoFinal = true,
  errorInsercion,
  errorActividad,
} = {}) {
  const operaciones = [];
  const clientInicial = {};
  const clientRegistro = {};

  let procesadaRecibida;
  let datosInsertados;
  let actividadRegistrada;

  const database = {
    async withTransaction(operacion) {
      operaciones.push('comprobar-acceso-inicial');
      return operacion(clientInicial);
    },
  };

  const acceso = {
    async bloquearDisponible(client, idProyecto, idUsuario) {
      assert.equal(idProyecto, ID_PROYECTO);
      assert.equal(idUsuario, ID_USUARIO);

      if (client === clientInicial) {
        return accesoInicial;
      }

      assert.strictEqual(client, clientRegistro);
      operaciones.push('comprobar-acceso-final');

      return accesoFinal;
    },
  };

  const persistencia = {
    async guardarYRegistrar(procesada, registrar) {
      operaciones.push('guardar-versiones');
      procesadaRecibida = procesada;

      const resultado = await registrar(clientRegistro, CLAVES);

      operaciones.push('confirmar-registro');
      return resultado;
    },
  };

  const fotografias = {
    async crear(client, datos) {
      assert.strictEqual(client, clientRegistro);
      operaciones.push('insertar-fotografia');
      datosInsertados = datos;

      if (errorInsercion) {
        throw errorInsercion;
      }

      return {
        id_fotografia: ID_FOTOGRAFIA,
        id_proyecto: datos.idProyecto,
        id_usuario_subida: datos.idUsuarioSubida,
        titulo: datos.titulo,
        url: datos.url,
        s3_key: datos.s3Key,
        original_s3_key: datos.originalS3Key,
        fecha_subida: new Date('2026-09-11T15:30:00.000Z'),
      };
    },
  };

  const actividades = {
    async crear(client, datos) {
      assert.strictEqual(client, clientRegistro);
      operaciones.push('registrar-actividad');
      actividadRegistrada = datos;

      if (errorActividad) {
        throw errorActividad;
      }
    },
  };

  return {
    servicio: new FotografiasSubidaService(
      database,
      acceso,
      persistencia,
      fotografias,
      actividades,
    ),
    operaciones,
    obtenerProcesada: () => procesadaRecibida,
    obtenerInsercion: () => datosInsertados,
    obtenerActividad: () => actividadRegistrada,
  };
}

test(
  'subir: coordina ambas versiones, la identidad y la actividad, y devuelve campos públicos',
  async () => {
    const escenario = crearEscenario();
    const original = await crearOriginal();
    const copiaOriginal = Buffer.from(original);

    const resultado = await escenario.servicio.subir(
      ID_PROYECTO,
      ID_USUARIO,
      { titulo: 'Avance de obra' },
      original,
    );

    const urlEsperada =
      `/api/proyectos/${ID_PROYECTO}/fotografias/archivos/`
      + '50000000-0000-4000-8000-000000000005.webp';

    assert.deepEqual(escenario.operaciones, [
      'comprobar-acceso-inicial',
      'guardar-versiones',
      'comprobar-acceso-final',
      'insertar-fotografia',
      'registrar-actividad',
      'confirmar-registro',
    ]);

    assert.deepEqual(escenario.obtenerInsercion(), {
      idProyecto: ID_PROYECTO,
      idUsuarioSubida: ID_USUARIO,
      titulo: 'Avance de obra',
      url: urlEsperada,
      s3Key: CLAVES.s3_key,
      originalS3Key: CLAVES.original_s3_key,
    });

    assert.deepEqual(escenario.obtenerActividad(), {
      idProyecto: ID_PROYECTO,
      idActor: ID_USUARIO,
      tipoAccion: 'FOTOGRAFIA_SUBIDA',
      mensaje: `Fotografía ${ID_FOTOGRAFIA} subida.`,
    });

    assert.deepEqual(resultado, {
      id_fotografia: ID_FOTOGRAFIA,
      id_proyecto: ID_PROYECTO,
      id_usuario_subida: ID_USUARIO,
      titulo: 'Avance de obra',
      url: urlEsperada,
      fecha_subida: '2026-09-11T15:30:00.000Z',
    });

    const procesada = escenario.obtenerProcesada();

    assert.deepEqual(procesada.original, copiaOriginal);
    assert.deepEqual(original, copiaOriginal);
    assert.equal(procesada.formatoOriginal, 'jpeg');
    assert.equal(
      (await sharp(procesada.optimizada).metadata()).format,
      'webp',
    );
  },
);

test(
  'subir: rechaza el acceso inicial antes de procesar o guardar contenido',
  async () => {
    const { servicio, operaciones } = crearEscenario({
      accesoInicial: false,
    });

    // El contenido inválido no debe llegar a inspeccionarse.
    await assert.rejects(
      servicio.subir(
        ID_PROYECTO,
        ID_USUARIO,
        { titulo: 'Prueba' },
        Buffer.from('No es una imagen.'),
      ),
      (error) => {
        assert.equal(error.getStatus(), 404);
        assert.equal(error.message, 'El proyecto no está disponible.');
        return true;
      },
    );

    assert.deepEqual(operaciones, ['comprobar-acceso-inicial']);
  },
);

test(
  'subir: no guarda versiones cuando falla la inspección del archivo',
  async () => {
    const { servicio, operaciones } = crearEscenario();

    await assert.rejects(
      servicio.subir(
        ID_PROYECTO,
        ID_USUARIO,
        { titulo: 'Prueba' },
        Buffer.alloc(0),
      ),
      (error) => {
        assert.equal(error.getStatus(), 400);
        return true;
      },
    );

    assert.deepEqual(operaciones, ['comprobar-acceso-inicial']);
  },
);

test(
  'subir: rechaza el registro si se pierde el acceso durante el procesamiento',
  async () => {
    const { servicio, operaciones } = crearEscenario({
      accesoFinal: false,
    });

    await assert.rejects(
      servicio.subir(
        ID_PROYECTO,
        ID_USUARIO,
        { titulo: 'Prueba' },
        await crearOriginal(),
      ),
      (error) => {
        assert.equal(error.getStatus(), 404);
        return true;
      },
    );

    assert.deepEqual(operaciones, [
      'comprobar-acceso-inicial',
      'guardar-versiones',
      'comprobar-acceso-final',
    ]);
  },
);

test(
  'subir: propaga un fallo de inserción sin registrar la actividad',
  async () => {
    const errorEsperado = new Error('Falló la inserción.');

    const { servicio, operaciones } = crearEscenario({
      errorInsercion: errorEsperado,
    });

    await assert.rejects(
      servicio.subir(
        ID_PROYECTO,
        ID_USUARIO,
        { titulo: 'Prueba' },
        await crearOriginal(),
      ),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(operaciones, [
      'comprobar-acceso-inicial',
      'guardar-versiones',
      'comprobar-acceso-final',
      'insertar-fotografia',
    ]);
  },
);

test(
  'subir: propaga el fallo del historial sin comunicar éxito',
  async () => {
    const errorEsperado = new Error('Falló el historial.');

    const { servicio, operaciones } = crearEscenario({
      errorActividad: errorEsperado,
    });

    await assert.rejects(
      servicio.subir(
        ID_PROYECTO,
        ID_USUARIO,
        { titulo: 'Prueba' },
        await crearOriginal(),
      ),
      (error) => error === errorEsperado,
    );

    assert.deepEqual(operaciones, [
      'comprobar-acceso-inicial',
      'guardar-versiones',
      'comprobar-acceso-final',
      'insertar-fotografia',
      'registrar-actividad',
    ]);
  },
);