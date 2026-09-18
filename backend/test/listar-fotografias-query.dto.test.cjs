require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');

const {
  ListarFotografiasQueryDto,
} = require(
  '../dist/modules/fotografias/dto/listar-fotografias-query.dto',
);

/**
 * Ejecuta la transformación y validación con las mismas opciones
 * utilizadas por la aplicación.
 *
 * No realiza consultas a PostgreSQL ni accede a archivos.
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
    metatype: ListarFotografiasQueryDto,
    data: undefined,
  });
}

test(
  'ListarFotografiasQueryDto: aplica los valores predeterminados',
  async () => {
    const resultado = await validarConsulta({});

    assert.ok(resultado instanceof ListarFotografiasQueryDto);
    assert.equal(resultado.pagina, 1);
    assert.equal(resultado.limite, 20);
  },
);

test(
  'ListarFotografiasQueryDto: convierte los parámetros de texto a números',
  async () => {
    const resultado = await validarConsulta({
      pagina: '2',
      limite: '12',
    });

    assert.equal(resultado.pagina, 2);
    assert.equal(resultado.limite, 12);
  },
);

test(
  'ListarFotografiasQueryDto: conserva el límite predeterminado cuando se omite',
  async () => {
    const resultado = await validarConsulta({
      pagina: '3',
    });

    assert.equal(resultado.pagina, 3);
    assert.equal(resultado.limite, 20);
  },
);

test(
  'ListarFotografiasQueryDto: acepta los máximos permitidos',
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
 * Cada entrada inválida genera una prueba independiente.
 * Además del rechazo, comprobamos que corresponda a HTTP 400.
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
  ['límite como arreglo', { limite: ['12', '20'] }],
  ['parámetro adicional', { orden: 'asc' }],
];

for (const [descripcion, entrada] of casosInvalidos) {
  test(
    `ListarFotografiasQueryDto: rechaza ${descripcion}`,
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