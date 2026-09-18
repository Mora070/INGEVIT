require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
  ListarProyectosQueryDto,
} = require('../dist/modules/proyectos/dto/listar-proyectos-query.dto');

const {
  createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Simula la validación de los parámetros de consulta HTTP.
 * Los valores normales de la URL llegan como cadenas.
 */
async function validarConsulta(query) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: ListarProyectosQueryDto,
    data: undefined,
  });
}

function comprobarConsultaRechazada(error) {
  assert.ok(error instanceof BadRequestException);
  assert.equal(error.getStatus(), 400);
  return true;
}

test('ListarProyectosQueryDto: aplica los valores predeterminados', async () => {
  const resultado = await validarConsulta({});

  assert.ok(resultado instanceof ListarProyectosQueryDto);
  assert.equal(resultado.pagina, 1);
  assert.equal(resultado.limite, 20);
});

test('ListarProyectosQueryDto: convierte los parámetros válidos a números', async () => {
  const resultado = await validarConsulta({
    pagina: '3',
    limite: '50',
  });

  assert.equal(resultado.pagina, 3);
  assert.equal(resultado.limite, 50);
});

test('ListarProyectosQueryDto: conserva el valor predeterminado del parámetro omitido', async () => {
  const soloPagina = await validarConsulta({ pagina: '2' });

  assert.equal(soloPagina.pagina, 2);
  assert.equal(soloPagina.limite, 20);

  const soloLimite = await validarConsulta({ limite: '10' });

  assert.equal(soloLimite.pagina, 1);
  assert.equal(soloLimite.limite, 10);
});

test('ListarProyectosQueryDto: acepta los extremos permitidos', async () => {
  const minimo = await validarConsulta({
    pagina: '1',
    limite: '1',
  });

  assert.equal(minimo.pagina, 1);
  assert.equal(minimo.limite, 1);

  const maximo = await validarConsulta({
    pagina: '2147483647',
    limite: '100',
  });

  assert.equal(maximo.pagina, 2147483647);
  assert.equal(maximo.limite, 100);
});

test('ListarProyectosQueryDto: rechaza páginas fuera del rango permitido', async () => {
  for (const pagina of ['0', '-1', '2147483648']) {
    await assert.rejects(
      () => validarConsulta({ pagina }),
      comprobarConsultaRechazada,
    );
  }
});

test('ListarProyectosQueryDto: rechaza límites fuera del rango permitido', async () => {
  for (const limite of ['0', '-1', '101']) {
    await assert.rejects(
      () => validarConsulta({ limite }),
      comprobarConsultaRechazada,
    );
  }
});

test('ListarProyectosQueryDto: rechaza formatos y tipos no admitidos', async () => {
  const valoresInvalidos = [
    '',
    ' ',
    ' 2 ',
    '1.5',
    '2.0',
    '1e2',
    '0x10',
    'Infinity',
    'NaN',
    'texto',
    null,
    true,
    {},
    ['1', '2'],
  ];

  for (const campo of ['pagina', 'limite']) {
    for (const valor of valoresInvalidos) {
      await assert.rejects(
        () => validarConsulta({ [campo]: valor }),
        comprobarConsultaRechazada,
      );
    }
  }
});

test('ListarProyectosQueryDto: rechaza parámetros adicionales', async () => {
  for (const [campo, valor] of [
    ['id_usuario', '10000000-0000-4000-8000-000000000001'],
    ['rol', 'ADMINISTRADOR'],
    ['incluir_eliminados', 'true'],
  ]) {
    await assert.rejects(
      () =>
        validarConsulta({
          pagina: '1',
          limite: '20',
          [campo]: valor,
        }),
      comprobarConsultaRechazada,
    );
  }
});

test('ListarProyectosQueryDto: no modifica los parámetros originales', async () => {
  const entrada = { pagina: '2', limite: '10' };

  await validarConsulta(entrada);

  assert.deepEqual(entrada, {
    pagina: '2',
    limite: '10',
  });
});