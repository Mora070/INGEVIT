require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FotografiasRepository,
} = require('../dist/modules/fotografias/fotografias.repository');

function crearEntrada() {
  return {
    idProyecto: '20000000-0000-4000-8000-000000000002',
    idUsuarioSubida: '10000000-0000-4000-8000-000000000001',
    titulo: 'Avance de obra',
    url: 'https://example.invalid/optimizada.webp',
    s3Key:
      'fotografias/50000000-0000-4000-8000-000000000005.webp',
    originalS3Key:
      'fotografias/60000000-0000-4000-8000-000000000006.jpeg',
  };
}

function crearRegistro(datos = crearEntrada()) {
  return {
    id_fotografia: '70000000-0000-4000-8000-000000000007',
    id_proyecto: datos.idProyecto,
    id_usuario_subida: datos.idUsuarioSubida,
    titulo: datos.titulo,
    url: datos.url,
    s3_key: datos.s3Key,
    original_s3_key: datos.originalS3Key,
    fecha_subida: new Date('2026-09-11T15:30:00.000Z'),
  };
}

/**
 * Simula exclusivamente el cliente de la transacción.
 * No conecta con PostgreSQL ni crea archivos.
 */
function crearEscenario({
  filas = [crearRegistro()],
  rowCount = 1,
  errorConsulta,
} = {}) {
  const consultas = [];

  const client = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros });

      if (errorConsulta) {
        throw errorConsulta;
      }

      return {
        rows: filas,
        rowCount,
      };
    },
  };

  return {
    repositorio: new FotografiasRepository(),
    client,
    consultas,
  };
}

test(
  'FotografiasRepository.crear: parametriza los metadatos y devuelve el registro creado',
  async () => {
    const datos = crearEntrada();
    const registro = crearRegistro(datos);

    const { repositorio, client, consultas } = crearEscenario({
      filas: [registro],
    });

    const resultado = await repositorio.crear(client, datos);

    assert.deepEqual(resultado, registro);
    assert.equal(consultas.length, 1);

    assert.deepEqual(consultas[0].parametros, [
      datos.idProyecto,
      datos.idUsuarioSubida,
      datos.titulo,
      datos.url,
      datos.s3Key,
      datos.originalS3Key,
    ]);

    const sql = consultas[0].sql.replace(/\s+/g, ' ').trim();

    assert.match(sql, /^INSERT INTO obra\.fotografias\b/i);
    assert.match(sql, /\bRETURNING\b/i);

    // El repositorio no debe controlar la transacción recibida.
    assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK)\b/i);

    for (const valor of consultas[0].parametros) {
      assert.equal(consultas[0].sql.includes(valor), false);
    }
  },
);

test(
  'FotografiasRepository.crear: mantiene un título malicioso fuera del SQL',
  async () => {
    const datos = {
      ...crearEntrada(),
      titulo: "'); DELETE FROM obra.fotografias; --",
    };

    const { repositorio, client, consultas } = crearEscenario({
      filas: [crearRegistro(datos)],
    });

    await repositorio.crear(client, datos);

    assert.equal(consultas.length, 1);
    assert.equal(consultas[0].sql.includes(datos.titulo), false);
    assert.equal(consultas[0].parametros[2], datos.titulo);
  },
);

test(
  'FotografiasRepository.crear: propaga el error de integridad original',
  async () => {
    const errorEsperado = Object.assign(
      new Error('Conflicto de clave simulado.'),
      {
        code: '23505',
        constraint: 'fotografias_original_s3_key_unique',
      },
    );

    const { repositorio, client, consultas } = crearEscenario({
      errorConsulta: errorEsperado,
    });

    await assert.rejects(
      repositorio.crear(client, crearEntrada()),
      (error) => error === errorEsperado,
    );

    assert.equal(consultas.length, 1);
  },
);

test(
  'FotografiasRepository.crear: rechaza una respuesta sin registro',
  async () => {
    const { repositorio, client } = crearEscenario({
      filas: [],
      rowCount: 1,
    });

    await assert.rejects(
      repositorio.crear(client, crearEntrada()),
      {
        message:
          'La inserción de la fotografía no devolvió el registro esperado.',
      },
    );
  },
);

test(
  'FotografiasRepository.crear: rechaza un conteo inesperado aunque reciba un registro',
  async () => {
    const { repositorio, client } = crearEscenario({
      rowCount: 0,
    });

    await assert.rejects(
      repositorio.crear(client, crearEntrada()),
      {
        message:
          'La inserción de la fotografía no devolvió el registro esperado.',
      },
    );
  },
);