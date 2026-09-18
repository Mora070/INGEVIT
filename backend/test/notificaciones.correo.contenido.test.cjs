const test = require('node:test');
const assert = require('node:assert/strict');

const {
  crearCorreoNotificacion,
} = require(
  '../dist/modules/notificaciones/correos/crear-correo-notificacion'
);

function notificacion(cambios = {}) {
  return {
    id_notificacion: '20000000-0000-4000-8000-000000000001',
    tipo: 'INCIDENCIA_CREADA',
    titulo: 'Incidencia creada',
    mensaje: 'Fisura en el acceso de la obra.',
    correo_receptor: 'colaborador@ingevit.test',
    ...cambios,
  };
}

test('correo de notificación: prepara destinatario, asunto y contenido esperado', () => {
  const resultado = crearCorreoNotificacion(notificacion());

  assert.deepEqual(resultado, {
    destinatario: 'colaborador@ingevit.test',
    asunto: 'INGEVIT: nueva incidencia en un proyecto',
    texto: [
      'Se ha registrado una nueva incidencia en un proyecto al que tienes acceso.',
      '',
      'Incidencia creada',
      'Fisura en el acceso de la obra.',
      '',
      'Ingresa a INGEVIT para consultar los detalles.',
      '',
      'Referencia de notificación: 20000000-0000-4000-8000-000000000001',
    ].join('\n'),
  });
});

test('correo de notificación: mantiene el contenido externo fuera de las cabeceras', () => {
  const contenido = 'Observación\r\nBcc: otra-persona@ingevit.test';

  const resultado = crearCorreoNotificacion(
    notificacion({
      titulo: contenido,
      mensaje: contenido,
    }),
  );

  assert.equal(
    resultado.asunto,
    'INGEVIT: nueva incidencia en un proyecto',
  );

  assert.equal(resultado.destinatario, 'colaborador@ingevit.test');
  assert.ok(resultado.texto.includes(contenido));

  // El constructor no expone campos para añadir otras cabeceras.
  assert.deepEqual(
    Object.keys(resultado).sort(),
    ['asunto', 'destinatario', 'texto'],
  );
});

test('correo de notificación: conserva Unicode y trata las etiquetas como texto', () => {
  const mensaje = 'Bogotá: revisión de señalización.\n<b>Atención</b>';

  const resultado = crearCorreoNotificacion(
    notificacion({ mensaje }),
  );

  assert.ok(resultado.texto.includes(mensaje));
  assert.equal(Object.hasOwn(resultado, 'html'), false);
});

test('correo de notificación: rechaza tipos sin plantilla implementada', () => {
  for (const tipo of ['OTRO_EVENTO', '', undefined]) {
    assert.throws(
      () => crearCorreoNotificacion(notificacion({ tipo })),
      /no tiene una plantilla/,
    );
  }
});

test('correo de notificación: no modifica los datos ni copia campos adicionales', () => {
  const datos = Object.freeze({
    ...notificacion(),
    password_hash: 'valor-que-no-debe-incluirse',
    estado_envio_correo: 'PENDIENTE',
  });

  const copia = { ...datos };
  const resultado = crearCorreoNotificacion(datos);

  assert.deepEqual(datos, copia);
  assert.equal(
    resultado.texto.includes('valor-que-no-debe-incluirse'),
    false,
  );

  assert.deepEqual(
    Object.keys(resultado).sort(),
    ['asunto', 'destinatario', 'texto'],
  );
});