require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  CorreoService,
} = require('../dist/modules/correos/correo.service');

const {
  crearTransporteCorreo,
} = require('../dist/modules/correos/correo-transporte');

/**
 * Comprobación manual del transporte SMTP local.
 *
 * Envía un único mensaje a Mailpit utilizando el servicio real.
 * No consulta PostgreSQL ni modifica notificaciones.
 *
 * CorreoService valida que la configuración corresponda
 * a Mailpit en loopback y a un entorno de desarrollo o pruebas.
 */
async function main() {
  const servicio = new CorreoService(crearTransporteCorreo);
  const referencia = randomUUID();

  try {
    const resultado = await servicio.enviar({
      destinatario: 'destinatario@ingevit.test',
      asunto: `INGEVIT: comprobación de correo ${referencia}`,
      texto: [
        'Comprobación del servicio de correo de INGEVIT.',
        '',
        'Este mensaje fue enviado por el backend a Mailpit.',
        'Los caracteres especiales deben visualizarse correctamente:',
        'Bogotá, construcción, fotografía, información, ñ.',
        '',
        `Referencia de comprobación: ${referencia}`,
      ].join('\n'),
    });

    assert.equal(typeof resultado.messageId, 'string');
    assert.ok(resultado.messageId.length > 0);

    console.log('OK: Mailpit aceptó el mensaje por SMTP.');
    console.log(`Referencia: ${referencia}`);
    console.log('Abre http://127.0.0.1:8025 y comprueba el contenido.');
  } finally {
    servicio.onApplicationShutdown();
  }
}

main().catch(() => {
  // Evitamos imprimir detalles internos del transporte.
  console.error(
    'No se completó la comprobación. Revisa que Mailpit esté iniciado ' +
    'y que las variables CORREO_* y NODE_ENV sean correctas.',
  );

  process.exitCode = 1;
});