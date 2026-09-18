require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificacionesCorreoService,
} = require(
  '../dist/modules/notificaciones/correos/notificaciones-correo.service'
);

function crearEscenario() {
  const id = '20000000-0000-4000-8000-000000000001';
  const reserva = '30000000-0000-4000-8000-000000000001';
  const client = {};

  const estado = {
    reservada: {
      id_notificacion: id,
      correo_reserva: reserva,
    },
    datos: {
      id_notificacion: id,
      tipo: 'INCIDENCIA_CREADA',
      titulo: 'Incidencia creada',
      mensaje: 'Fisura en el acceso.',
      correo_receptor: 'destinatario@ingevit.test',
    },
    enviada: true,
    fallida: true,
    errorConsulta: null,
    errorEnvio: null,
    errorConfirmacion: null,
    errorReservaCommit: null,
    transacciones: 0,
    enTransaccion: false,
    eventos: [],
    mensajes: [],
    actualizaciones: [],
  };

  const database = {
    async withTransaction(operacion) {
      const numero = ++estado.transacciones;
      estado.enTransaccion = true;

      try {
        const resultado = await operacion(client);

        // Simula una reserva ejecutada cuyo COMMIT no se confirma.
        if (numero === 1 && estado.errorReservaCommit) {
          throw estado.errorReservaCommit;
        }

        estado.eventos.push('commit');
        return resultado;
      } finally {
        estado.enTransaccion = false;
      }
    },
  };

  const repository = {
    async reservarSiguiente(recibido, segundos, intentos) {
      assert.strictEqual(recibido, client);
      assert.equal(segundos, 120);
      assert.equal(intentos, 5);
      estado.eventos.push('reservar');
      return estado.reservada;
    },

    async obtenerDatosParaEnvio(recibido, idRecibido, token) {
      assert.strictEqual(recibido, client);
      assert.equal(idRecibido, id);
      assert.equal(token, reserva);
      estado.eventos.push('consultar');

      if (estado.errorConsulta) throw estado.errorConsulta;

      return estado.datos;
    },

    async marcarEnviada(recibido, idRecibido, token) {
      assert.strictEqual(recibido, client);
      estado.actualizaciones.push(['ENVIADA', idRecibido, token]);
      estado.eventos.push('marcarEnviada');

      if (estado.errorConfirmacion) {
        throw estado.errorConfirmacion;
      }

      return estado.enviada;
    },

    async marcarFallida(recibido, idRecibido, token) {
      assert.strictEqual(recibido, client);
      estado.actualizaciones.push(['FALLIDA', idRecibido, token]);
      estado.eventos.push('marcarFallida');
      return estado.fallida;
    },
  };

  const correo = {
    async enviar(mensaje) {
      assert.equal(
        estado.enTransaccion,
        false,
        'SMTP no debe ejecutarse dentro de una transacción',
      );

      estado.eventos.push('enviar');
      estado.mensajes.push(mensaje);

      if (estado.errorEnvio) throw estado.errorEnvio;

      return { messageId: '<prueba@ingevit.test>' };
    },
  };

  estado.servicio = new NotificacionesCorreoService(
    database,
    repository,
    correo,
  );

  return estado;
}

test('correo coordinador: termina sin enviar cuando no hay pendientes', async () => {
  const e = crearEscenario();
  e.reservada = null;

  assert.equal(await e.servicio.procesarSiguiente(), 'SIN_PENDIENTES');
  assert.deepEqual(e.eventos, ['reservar', 'commit']);
  assert.equal(e.mensajes.length, 0);
});

test('correo coordinador: confirma la reserva antes de enviar y registra el éxito', async () => {
  const e = crearEscenario();

  assert.equal(await e.servicio.procesarSiguiente(), 'ENVIADA');

  assert.deepEqual(e.eventos, [
    'reservar',
    'commit',
    'consultar',
    'commit',
    'enviar',
    'marcarEnviada',
    'commit',
  ]);

  assert.equal(e.mensajes.length, 1);
  assert.equal(
    e.mensajes[0].destinatario,
    'destinatario@ingevit.test',
  );

  assert.deepEqual(e.actualizaciones, [[
    'ENVIADA',
    e.reservada.id_notificacion,
    e.reservada.correo_reserva,
  ]]);
});

test('correo coordinador: no envía si no se confirma la transacción de reserva', async () => {
  const e = crearEscenario();
  const error = new Error('Resultado de COMMIT desconocido');
  e.errorReservaCommit = error;

  await assert.rejects(
    () => e.servicio.procesarSiguiente(),
    (recibido) => recibido === error,
  );

  assert.deepEqual(e.eventos, ['reservar']);
  assert.equal(e.mensajes.length, 0);
  assert.equal(e.actualizaciones.length, 0);
});

test('correo coordinador: descarta una notificación que ya no puede enviarse', async () => {
  const e = crearEscenario();
  e.datos = null;

  assert.equal(await e.servicio.procesarSiguiente(), 'DESCARTADA');
  assert.equal(e.mensajes.length, 0);

  assert.deepEqual(e.actualizaciones, [[
    'FALLIDA',
    e.reservada.id_notificacion,
    e.reservada.correo_reserva,
  ]]);
});

test('correo coordinador: propaga errores de consulta sin tratarlos como falta de acceso', async () => {
  const e = crearEscenario();
  const error = new Error('PostgreSQL no disponible');
  e.errorConsulta = error;

  await assert.rejects(
    () => e.servicio.procesarSiguiente(),
    (recibido) => recibido === error,
  );

  assert.equal(e.mensajes.length, 0);
  assert.equal(e.actualizaciones.length, 0);
});

test('correo coordinador: finaliza errores de plantilla o SMTP sin reintentar', async () => {
  for (const causa of ['plantilla', 'smtp']) {
    const e = crearEscenario();

    if (causa === 'plantilla') {
      e.datos.tipo = 'TIPO_NO_IMPLEMENTADO';
    } else {
      e.errorEnvio = new Error('Error SMTP simulado');
    }

    assert.equal(await e.servicio.procesarSiguiente(), 'FALLIDA');
    assert.equal(e.mensajes.length, causa === 'smtp' ? 1 : 0);
    assert.equal(e.actualizaciones.length, 1);
    assert.equal(e.actualizaciones[0][0], 'FALLIDA');
  }
});

test('correo coordinador: no reenvía ni marca FALLIDA si falla el registro posterior al envío', async () => {
  const e = crearEscenario();
  const error = new Error('Fallo al registrar ENVIADA');
  e.errorConfirmacion = error;

  await assert.rejects(
    () => e.servicio.procesarSiguiente(),
    (recibido) => recibido === error,
  );

  assert.equal(e.mensajes.length, 1);
  assert.equal(e.actualizaciones.length, 1);
  assert.equal(e.actualizaciones[0][0], 'ENVIADA');
});

test('correo coordinador: informa cuando perdió la reserva sin repetir el envío', async () => {
  for (const caso of ['enviada', 'fallida', 'descartada']) {
    const e = crearEscenario();
    e.enviada = false;
    e.fallida = false;

    if (caso === 'fallida') {
      e.errorEnvio = new Error('Error SMTP simulado');
    }

    if (caso === 'descartada') {
      e.datos = null;
    }

    assert.equal(
      await e.servicio.procesarSiguiente(),
      'RESERVA_PERDIDA',
    );

    assert.equal(e.mensajes.length, caso === 'descartada' ? 0 : 1);
    assert.equal(e.actualizaciones.length, 1);
  }
});