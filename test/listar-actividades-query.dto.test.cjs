require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');

const {
  ListarActividadesQueryDto,
} = require(
  '../dist/modules/actividades/dto/listar-actividades-query.dto',
);

/**
 * Ejecuta la transformación y validación con las mismas opciones
 * utilizadas por la aplicación.
 *
 * Cada invocación crea su propio pipe para mantener las pruebas aisladas.
 */
async function validarConsulta(entrada) {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
    validationError: {
      target: false,
      value: false,
    },
  });

  return pipe.transform(entrada, {
    type: 'query',
    metatype: ListarActividadesQueryDto,
    data: undefined,
  });
}

test(
  'ListarActividadesQueryDto: aplica los valores predeterminados',
  async () => {
    const resultado = await validarConsulta({});

    assert.ok(resultado instanceof ListarActividadesQueryDto);
    assert.equal(resultado.pagina, 1);
    assert.equal(resultado.limite, 20);
  },
);

test(
  'ListarActividadesQueryDto: convierte cadenas de dígitos a números',
  async () => {
    const resultado = await validarConsulta({
      pagina: '2',
      limite: '50',
    });

    assert.equal(resultado.pagina, 2);
    assert.equal(resultado.limite, 50);
  },
);

test(
  'ListarActividadesQueryDto: conserva el límite predeterminado cuando se omite',
  async () => {
    const resultado = await validarConsulta({
      pagina: '3',
    });

    assert.equal(resultado.pagina, 3);
    assert.equal(resultado.limite, 20);
  },
);

test(
  'ListarActividadesQueryDto: acepta los valores máximos permitidos',
  async () => {
    const resultado = await validarConsulta({
      pagina: '2147483647',
      limite: '100',
    });

    assert.equal(resultado.pagina, 2147483647);
    assert.equal(resultado.limite, 100);
  },
);

/**
 * Cada caso genera una prueba independiente.
 * No basta con que la transformación termine: debe rechazar con HTTP 400.
 */
const casosInvalidos = [
  ['página cero', { pagina: '0' }],
  ['página negativa', { pagina: '-1' }],
  ['página decimal', { pagina: '1.5' }],
  ['página superior al máximo', { pagina: '2147483648' }],
  ['página vacía', { pagina: '' }],
  ['página con espacios', { pagina: ' 2 ' }],
  ['página en notación exponencial', { pagina: '1e2' }],
  ['página con texto', { pagina: 'abc' }],
  ['página como arreglo', { pagina: ['1', '2'] }],
  ['página como objeto', { pagina: { valor: '1' } }],
  ['página booleana', { pagina: true }],
  ['página nula', { pagina: null }],
  ['límite cero', { limite: '0' }],
  ['límite superior al máximo', { limite: '101' }],
  ['límite decimal', { limite: '2.5' }],
  ['límite vacío', { limite: '' }],
  ['límite como arreglo', { limite: ['20', '30'] }],
  ['parámetro adicional', { orden: 'asc' }],
];

for (const [descripcion, entrada] of casosInvalidos) {
  test(
    `ListarActividadesQueryDto: rechaza ${descripcion}`,
    async () => {
      await assert.rejects(
        validarConsulta(entrada),
        (error) => {
          assert.equal(error.getStatus(), 400);
          return true;
        },
      );
    },
  );
}