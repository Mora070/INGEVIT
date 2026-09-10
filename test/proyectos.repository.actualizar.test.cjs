require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ProyectosRepository,
} = require('../dist/modules/proyectos/proyectos.repository');

const ID_PROYECTO = '10000000-0000-4000-8000-000000000001';
const ID_PROPIETARIO = '20000000-0000-4000-8000-000000000002';

function crearDatos(cambios = {}) {
  return {
    nombre: 'Proyecto actualizado',
    descripcion: 'Descripción actualizada',
    direccion: 'Dirección actualizada',
    contratante: 'Cliente actualizado',
    fechaInicio: '2026-09-09',
    fechaFinalizacion: null,
    estadoProyecto: 'PAUSA',
    latitud: null,
    longitud: null,
    ...cambios,
  };
}

function crearFila() {
  return {
    id_proyecto: ID_PROYECTO,
    id_propietario: ID_PROPIETARIO,
    nombre: 'Proyecto actualizado',
    descripcion: 'Descripción actualizada',
    direccion: 'Dirección actualizada',
    contratante: 'Cliente actualizado',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'PAUSA',
    activo: true,
    latitud: null,
    longitud: null,
  };
}

/**
 * Hace fallar cualquier consulta que intente salir
 * del cliente transaccional proporcionado.
 */
function crearRepositorio() {
  return new ProyectosRepository({
    async query() {
      throw new Error('Debe utilizarse el cliente transaccional.');
    },
  });
}

test('bloquearEditablePorPropietario: parametriza la identidad y bloquea el proyecto', async () => {
  const llamadas = [];
  const fila = crearFila();

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila] };
    },
  };

  const resultado =
    await crearRepositorio().bloquearEditablePorPropietario(
      client,
      ID_PROYECTO,
      ID_PROPIETARIO,
    );

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].values, [
    ID_PROYECTO,
    ID_PROPIETARIO,
  ]);

  assert.match(llamadas[0].sql, /FOR UPDATE OF p/i);
  assert.match(
    llamadas[0].sql,
    /p\.id_propietario\s*=\s*\$2::uuid/i,
  );
  assert.match(llamadas[0].sql, /p\.activo\s*=\s*true/i);
});

test('bloquearEditablePorPropietario: devuelve null cuando no hay una fila editable', async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  };

  const resultado =
    await crearRepositorio().bloquearEditablePorPropietario(
      client,
      ID_PROYECTO,
      ID_PROPIETARIO,
    );

  assert.equal(resultado, null);
});

test('bloquearEditablePorPropietario: propaga errores de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado del bloqueo');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().bloquearEditablePorPropietario(
        client,
        ID_PROYECTO,
        ID_PROPIETARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('actualizar proyecto: utiliza el cliente recibido y parametriza los datos', async () => {
  const llamadas = [];
  const fila = crearFila();

  const client = {
    async query(sql, values) {
      llamadas.push({ sql, values });
      return { rows: [fila] };
    },
  };

  const resultado = await crearRepositorio().actualizar(
    client,
    ID_PROYECTO,
    ID_PROPIETARIO,
    crearDatos(),
  );

  assert.strictEqual(resultado, fila);
  assert.equal(llamadas.length, 1);

  assert.deepEqual(llamadas[0].values, [
    ID_PROYECTO,
    ID_PROPIETARIO,
    'Proyecto actualizado',
    'Descripción actualizada',
    'Dirección actualizada',
    'Cliente actualizado',
    '2026-09-09',
    null,
    'PAUSA',
    null,
    null,
  ]);

  assert.match(llamadas[0].sql, /UPDATE obra\.proyectos/i);
  assert.match(
    llamadas[0].sql,
    /WHERE\s+id_proyecto\s*=\s*\$1::uuid/i,
  );
  assert.match(
    llamadas[0].sql,
    /AND\s+id_propietario\s*=\s*\$2::uuid/i,
  );
  assert.match(llamadas[0].sql, /AND\s+activo\s*=\s*true/i);
});

test('actualizar proyecto: mantiene los datos editables separados de los campos protegidos', async () => {
  let consulta;

  const client = {
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [crearFila()] };
    },
  };

  await crearRepositorio().actualizar(
    client,
    ID_PROYECTO,
    ID_PROPIETARIO,
    {
      ...crearDatos(),
      idPropietario: '30000000-0000-4000-8000-000000000003',
      activo: false,
    },
  );

  assert.equal(consulta.values[1], ID_PROPIETARIO);
  assert.equal(consulta.values.length, 11);

  // Comprueba únicamente la sección que asigna columnas.
  const asignaciones = consulta.sql.match(
    /\bSET\b([\s\S]*?)\bWHERE\b/i,
  );

  assert.ok(asignaciones);
  assert.doesNotMatch(
    asignaciones[1],
    /\b(id_propietario|activo|id_proyecto)\s*=/i,
  );
});

test('actualizar proyecto: conserva coordenadas iguales a cero y la fecha final', async () => {
  let parametros;

  const client = {
    async query(sql, values) {
      parametros = values;
      return { rows: [crearFila()] };
    },
  };

  await crearRepositorio().actualizar(
    client,
    ID_PROYECTO,
    ID_PROPIETARIO,
    crearDatos({
      fechaFinalizacion: '2026-12-31',
      latitud: 0,
      longitud: 0,
    }),
  );

  assert.equal(parametros[7], '2026-12-31');
  assert.equal(parametros[9], 0);
  assert.equal(parametros[10], 0);
});

test('actualizar proyecto: mantiene texto malicioso fuera de la sentencia SQL', async () => {
  const nombre = "Proyecto'; DELETE FROM obra.proyectos; --";
  let consulta;

  const client = {
    async query(sql, values) {
      consulta = { sql, values };
      return { rows: [crearFila()] };
    },
  };

  await crearRepositorio().actualizar(
    client,
    ID_PROYECTO,
    ID_PROPIETARIO,
    crearDatos({ nombre }),
  );

  assert.equal(consulta.sql.includes(nombre), false);
  assert.equal(consulta.values[2], nombre);
});

test('actualizar proyecto: rechaza una actualización sin registro retornado', async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().actualizar(
        client,
        ID_PROYECTO,
        ID_PROPIETARIO,
        crearDatos(),
      ),
    {
      message:
        'La actualización del proyecto no devolvió el registro esperado.',
    },
  );
});

test('actualizar proyecto: propaga el error original de PostgreSQL', async () => {
  const errorOriginal = new Error('Fallo simulado del UPDATE');

  const client = {
    async query() {
      throw errorOriginal;
    },
  };

  await assert.rejects(
    () =>
      crearRepositorio().actualizar(
        client,
        ID_PROYECTO,
        ID_PROPIETARIO,
        crearDatos(),
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});