require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
//const nodemailer = require('nodemailer');

const {
  CorreoService,
} = require('../dist/modules/correos/correo.service');

/**
 * Inyecta una fábrica simulada directamente en el servicio.
 *
 * Ninguna prueba de este archivo construye un transporte SMTP real.
 * Las variables de entorno se restauran incluso si falla el constructor.
 */
function crearEscenario() {
  const variables = {
    NODE_ENV: 'test',
    CORREO_PROVEEDOR: 'mailpit',
    CORREO_SMTP_HOST: '127.0.0.1',
    CORREO_SMTP_PORT: '1025',
    CORREO_REMITENTE_NOMBRE: 'INGEVIT Pruebas',
    CORREO_REMITENTE_DIRECCION: 'notificaciones@ingevit.test',
  };

  const anteriores = new Map(
    Object.keys(variables).map((clave) => [
      clave,
      process.env[clave],
    ]),
  );

  const escenario = {
    opciones: undefined,
    enviados: [],
    cierres: 0,
    error: undefined,
    respuesta: {
      accepted: ['destinatario@ingevit.test'],
      rejected: [],
      messageId: '<prueba@ingevit.test>',
    },
    servicio: undefined,
  };

  const crearTransporteSimulado = (opciones) => {
    escenario.opciones = opciones;

    return {
      async sendMail(mensaje) {
        escenario.enviados.push(mensaje);

        if (escenario.error) {
          throw escenario.error;
        }

        return escenario.respuesta;
      },

      close() {
        escenario.cierres += 1;
      },
    };
  };

  try {
    Object.assign(process.env, variables);

    escenario.servicio = new CorreoService(
      crearTransporteSimulado,
    );
  } finally {
    for (const [clave, valor] of anteriores) {
      if (valor === undefined) {
        delete process.env[clave];
      } else {
        process.env[clave] = valor;
      }
    }
  }

  return escenario;
}

function mensajeValido(cambios = {}) {
  return {
    destinatario: 'destinatario@ingevit.test',
    asunto: 'Nueva incidencia',
    texto: 'Se registró una incidencia en el proyecto.',
    ...cambios,
  };
}

test('CorreoService: configura Mailpit sin enviar al construir el servicio', () => {
  const escenario = crearEscenario();

  assert.equal(escenario.opciones.host, '127.0.0.1');
  assert.equal(escenario.opciones.port, 1025);
  assert.equal(escenario.opciones.secure, false);
  assert.equal(escenario.opciones.ignoreTLS, true);
  assert.equal(escenario.opciones.pool, false);

  assert.equal(escenario.opciones.connectionTimeout, 5_000);
  assert.equal(escenario.opciones.greetingTimeout, 5_000);
  assert.equal(escenario.opciones.socketTimeout, 15_000);

  assert.equal(escenario.opciones.disableFileAccess, true);
  assert.equal(escenario.opciones.disableUrlAccess, true);
  assert.equal(escenario.opciones.logger, false);
  assert.equal(escenario.opciones.debug, false);
  assert.equal(escenario.opciones.auth, undefined);

  assert.equal(escenario.enviados.length, 0);
});

test('CorreoService: envía texto a un destinatario con el remitente configurado', async () => {
  const escenario = crearEscenario();
  const mensaje = Object.freeze(mensajeValido());

  const resultado = await escenario.servicio.enviar(mensaje);

  assert.deepEqual(resultado, {
    messageId: '<prueba@ingevit.test>',
  });

  assert.deepEqual(escenario.enviados, [{
    from: {
      name: 'INGEVIT Pruebas',
      address: 'notificaciones@ingevit.test',
    },
    to: [{
      address: 'destinatario@ingevit.test',
      name: '',
    }],
    subject: mensaje.asunto,
    text: mensaje.texto,
  }]);
});

test('CorreoService: rechaza destinatarios inválidos antes de llamar a SMTP', async () => {
  const escenario = crearEscenario();

  for (const destinatario of [
    undefined,
    null,
    123,
    '',
    'incorrecto',
    ' destinatario@ingevit.test',
    'destinatario@ingevit.test\r\nBcc: otro@ingevit.test',
    'uno@ingevit.test, dos@ingevit.test',
  ]) {
    await assert.rejects(
      () => escenario.servicio.enviar(
        mensajeValido({ destinatario }),
      ),
      /destinatario/,
    );
  }

  assert.equal(escenario.enviados.length, 0);
});

test('CorreoService: rechaza asuntos inválidos antes de llamar a SMTP', async () => {
  const escenario = crearEscenario();

  for (const asunto of [
    undefined,
    null,
    123,
    '',
    '   ',
    'Incidencia\r\nBcc: otro@ingevit.test',
    'Incidencia\u0000',
  ]) {
    await assert.rejects(
      () => escenario.servicio.enviar(
        mensajeValido({ asunto }),
      ),
      /asunto/,
    );
  }

  assert.equal(escenario.enviados.length, 0);
});

test('CorreoService: valida el contenido y conserva sus saltos de línea', async () => {
  const escenario = crearEscenario();

  for (const texto of [
    undefined,
    null,
    123,
    '',
    '   ',
    'Contenido\u0000',
  ]) {
    await assert.rejects(
      () => escenario.servicio.enviar(
        mensajeValido({ texto }),
      ),
      /contenido/,
    );
  }

  assert.equal(escenario.enviados.length, 0);

  const texto = 'Proyecto Norte\n\nSe registró una incidencia.';

  await escenario.servicio.enviar(mensajeValido({ texto }));

  assert.equal(escenario.enviados.length, 1);
  assert.equal(escenario.enviados[0].text, texto);
});

test('CorreoService: propaga el error de SMTP sin reintentar', async () => {
  const escenario = crearEscenario();
  const error = new Error('Fallo SMTP simulado');

  escenario.error = error;

  await assert.rejects(
    () => escenario.servicio.enviar(mensajeValido()),
    (recibido) => recibido === error,
  );

  assert.equal(escenario.enviados.length, 1);
});

test('CorreoService: rechaza resultados sin una única aceptación completa', async () => {
  const escenario = crearEscenario();

  const respuestas = [
    {
      accepted: [],
      rejected: ['destinatario@ingevit.test'],
    },
    {
      accepted: [],
      rejected: [],
    },
    {
      accepted: ['destinatario@ingevit.test'],
      rejected: ['otro@ingevit.test'],
    },
    {
      accepted: [
        'destinatario@ingevit.test',
        'otro@ingevit.test',
      ],
      rejected: [],
    },
  ];

  for (const respuesta of respuestas) {
    escenario.respuesta = {
      ...respuesta,
      messageId: '<prueba@ingevit.test>',
    };

    await assert.rejects(
      () => escenario.servicio.enviar(mensajeValido()),
      /SMTP no aceptó/,
    );
  }

  assert.equal(escenario.enviados.length, respuestas.length);
});

test('CorreoService: cierra el transporte durante el apagado', () => {
  const escenario = crearEscenario();

  escenario.servicio.onApplicationShutdown();

  assert.equal(escenario.cierres, 1);
  assert.equal(escenario.enviados.length, 0);
});