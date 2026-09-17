require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  CambiarPasswordService,
} = require('../dist/modules/auth/services/cambiar-password.service');

const ID = '20000000-0000-4000-8000-000000000001';

function crearEscenario() {
  const e = {
    usuario: {
      id_usuario: ID,
      estado: 'ACTIVO',
      password_hash: 'hash-actual',
    },
    coincide: true,
    actualizada: true,
    errorConsulta: null,
    errorVerificacion: null,
    errorHash: null,
    errorActualizacion: null,
    eventos: [],
  };

  e.servicio = new CambiarPasswordService(
    {
      async buscarPorIdParaAutenticacion(id) {
        e.eventos.push(['consultar', id]);
        if (e.errorConsulta) throw e.errorConsulta;
        return e.usuario;
      },

      async actualizarPasswordSiCoincide(id, anterior, nuevo) {
        e.eventos.push(['actualizar', id, anterior, nuevo]);
        if (e.errorActualizacion) throw e.errorActualizacion;
        return e.actualizada;
      },
    },
    {
      async verificar(password, hash) {
        e.eventos.push(['verificar', password, hash]);
        if (e.errorVerificacion) throw e.errorVerificacion;
        return e.coincide;
      },

      async generarHash(password) {
        e.eventos.push(['generar', password]);
        if (e.errorHash) throw e.errorHash;
        return 'hash-nuevo';
      },
    },
  );

  return e;
}

function datos(cambios = {}) {
  return {
    password_actual: 'Contraseña anterior',
    password_nueva: 'Nueva frase de acceso',
    ...cambios,
  };
}

test('cambiar password: verifica, genera y actualiza en orden sin devolver datos', async () => {
  const e = crearEscenario();

  const resultado = await e.servicio.cambiar(ID, datos());

  assert.equal(resultado, undefined);

  assert.deepEqual(e.eventos, [
    ['consultar', ID],
    ['verificar', 'Contraseña anterior', 'hash-actual'],
    ['generar', 'Nueva frase de acceso'],
    ['actualizar', ID, 'hash-actual', 'hash-nuevo'],
  ]);
});

test('cambiar password: rechaza cuentas inexistentes o inactivas', async () => {
  for (const usuario of [
    null,
    { estado: 'INACTIVO', password_hash: 'hash-actual' },
  ]) {
    const e = crearEscenario();
    e.usuario = usuario;

    await assert.rejects(
      () => e.servicio.cambiar(ID, datos()),
      UnauthorizedException,
    );

    assert.deepEqual(e.eventos, [['consultar', ID]]);
  }
});

test('cambiar password: no asigna una contraseña a una cuenta exclusiva de Google', async () => {
  const e = crearEscenario();
  e.usuario.password_hash = null;

  await assert.rejects(
    () => e.servicio.cambiar(ID, datos()),
    BadRequestException,
  );

  assert.deepEqual(e.eventos, [['consultar', ID]]);
});

test('cambiar password: rechaza una contraseña actual incorrecta sin generar otro hash', async () => {
  const e = crearEscenario();
  e.coincide = false;

  await assert.rejects(
    () => e.servicio.cambiar(ID, datos()),
    UnauthorizedException,
  );

  assert.deepEqual(e.eventos, [
    ['consultar', ID],
    ['verificar', 'Contraseña anterior', 'hash-actual'],
  ]);
});

test('cambiar password: rechaza reutilizar la contraseña después de verificarla', async () => {
  const e = crearEscenario();

  await assert.rejects(
    () => e.servicio.cambiar(ID, datos({
      password_nueva: 'Contraseña anterior',
    })),
    BadRequestException,
  );

  assert.deepEqual(e.eventos, [
    ['consultar', ID],
    ['verificar', 'Contraseña anterior', 'hash-actual'],
  ]);
});

test('cambiar password: conserva espacios y no modifica la entrada', async () => {
  const e = crearEscenario();

  const entrada = Object.freeze(datos({
    password_actual: '  Contraseña anterior  ',
    password_nueva: '  Nueva frase de acceso ñ  ',
  }));

  await e.servicio.cambiar(ID, entrada);

  assert.deepEqual(e.eventos[1], [
    'verificar',
    entrada.password_actual,
    'hash-actual',
  ]);

  assert.deepEqual(e.eventos[2], [
    'generar',
    entrada.password_nueva,
  ]);
});

test('cambiar password: informa un conflicto si el hash cambió antes de guardar', async () => {
  const e = crearEscenario();
  e.actualizada = false;

  await assert.rejects(
    () => e.servicio.cambiar(ID, datos()),
    ConflictException,
  );

  assert.equal(
    e.eventos.filter(([tipo]) => tipo === 'actualizar').length,
    1,
  );
});

test('cambiar password: propaga errores de consulta y criptografía', async () => {
  for (const [campo, eventosEsperados] of [
    ['errorConsulta', 1],
    ['errorVerificacion', 2],
    ['errorHash', 3],
  ]) {
    const e = crearEscenario();
    const error = new Error('Fallo técnico simulado');
    e[campo] = error;

    await assert.rejects(
      () => e.servicio.cambiar(ID, datos()),
      (recibido) => recibido === error,
    );

    assert.equal(e.eventos.length, eventosEsperados);
    assert.equal(
      e.eventos.some(([tipo]) => tipo === 'actualizar'),
      false,
    );
  }
});

test('cambiar password: propaga errores de escritura sin reintentar', async () => {
  const e = crearEscenario();
  const error = new Error('Fallo de escritura');
  e.errorActualizacion = error;

  await assert.rejects(
    () => e.servicio.cambiar(ID, datos()),
    (recibido) => recibido === error,
  );

  assert.equal(
    e.eventos.filter(([tipo]) => tipo === 'actualizar').length,
    1,
  );
});