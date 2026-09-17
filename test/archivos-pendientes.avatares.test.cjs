require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ArchivosPendientesService,
} = require('../dist/modules/almacenamiento/archivos-pendientes.service');

const {
  ArchivosPendientesRepository,
} = require('../dist/modules/almacenamiento/archivos-pendientes.repository');

const CLAVE =
  'avatares/10000000-0000-4000-8000-000000000001.webp';

/**
 * Conserva la comprobación real del repositorio y simula sus dependencias.
 * No consulta PostgreSQL ni elimina archivos del equipo.
 */
function preparar({
  referenciado = false,
  respuesta,
  errorConsulta,
  errorEliminacion,
} = {}) {
  const operaciones = [];

  const client = {
    async query(sql, valores) {
      operaciones.push('consultar');

      // La búsqueda debe utilizar la clave como parámetro.
      assert.deepEqual(valores, [CLAVE]);
      assert.ok(!sql.includes(CLAVE));
      assert.match(sql, /FROM\s+obra\.usuarios/i);
      assert.match(sql, /WHERE\s+foto_perfil_key\s*=\s*\$1/i);

      // Una cuenta inactiva también conserva su avatar.
      assert.doesNotMatch(sql, /\bestado\b/i);

      if (errorConsulta) {
        throw errorConsulta;
      }

      return respuesta ?? {
        rowCount: 1,
        rows: [{ referenciado }],
      };
    },
  };

  const repository = new ArchivosPendientesRepository();

  // Solo sustituimos la gestión de la cola; la consulta de referencias
  // se ejecuta mediante estaReferenciadoEnAvatares del repositorio real.
  repository.bloquearSiguiente = async (cliente) => {
    assert.strictEqual(cliente, client);
    operaciones.push('seleccionar');

    return {
      s3_key: CLAVE,
      fecha_creacion: new Date('2026-09-16T00:00:00Z'),
    };
  };

  repository.completar = async (cliente, clave) => {
    assert.strictEqual(cliente, client);
    assert.equal(clave, CLAVE);
    operaciones.push('completar');
  };

  const database = {
    async withTransaction(operacion) {
      // Este doble comprueba la coordinación. Las transacciones reales
      // corresponden a las pruebas de integración.
      return operacion(client);
    },
  };

  const almacenamiento = {
    async eliminar(clave) {
      assert.equal(clave, CLAVE);
      operaciones.push('eliminar');

      if (errorEliminacion) {
        throw errorEliminacion;
      }
    },
  };

  const service = new ArchivosPendientesService(
    database,
    repository,
    almacenamiento,
  );

  return {
    operaciones,
    ejecutar: () => service.procesarSiguiente(),
  };
}

test('avatares: conserva el archivo mientras exista una referencia', async () => {
  const { ejecutar, operaciones } = preparar({
    referenciado: true,
  });

  await assert.rejects(ejecutar, {
    message:
      'El archivo pendiente continúa referenciado por una fotografía de perfil.',
  });

  assert.deepEqual(operaciones, ['seleccionar', 'consultar']);
});

test('avatares: elimina el archivo sin referencias antes de completar la tarea', async () => {
  const { ejecutar, operaciones } = preparar();

  assert.equal(await ejecutar(), true);

  assert.deepEqual(operaciones, [
    'seleccionar',
    'consultar',
    'eliminar',
    'completar',
  ]);
});

test('avatares: no elimina archivos si falla la consulta de referencias', async () => {
  const error = new Error('Fallo simulado de PostgreSQL');
  const { ejecutar, operaciones } = preparar({
    errorConsulta: error,
  });

  await assert.rejects(ejecutar, (recibido) => recibido === error);

  assert.deepEqual(operaciones, ['seleccionar', 'consultar']);
});

test('avatares: rechaza respuestas de referencias incompletas o inválidas', async () => {
  const respuestas = [
    { rowCount: 0, rows: [] },
    { rowCount: 1, rows: [] },
    { rowCount: 1, rows: [{ referenciado: 'false' }] },
    { rowCount: 1, rows: [{ referenciado: null }] },
    {
      rowCount: 2,
      rows: [{ referenciado: false }, { referenciado: false }],
    },
  ];

  for (const respuesta of respuestas) {
    const { ejecutar, operaciones } = preparar({ respuesta });

    await assert.rejects(ejecutar, {
      message:
        'No se pudo comprobar si el avatar continúa referenciado.',
    });

    assert.deepEqual(operaciones, ['seleccionar', 'consultar']);
  }
});

test('avatares: conserva la tarea si falla la eliminación del archivo', async () => {
  const error = new Error('Fallo simulado de almacenamiento');
  const { ejecutar, operaciones } = preparar({
    errorEliminacion: error,
  });

  await assert.rejects(ejecutar, (recibido) => recibido === error);

  assert.deepEqual(operaciones, [
    'seleccionar',
    'consultar',
    'eliminar',
  ]);
});