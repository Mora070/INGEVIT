require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UsuariosAvatarArchivosService,
} = require('../dist/modules/usuarios/usuarios-avatar-archivos.service');

/**
 * Comprueba la escritura mediante flujos.
 * La conversión real a WebP se prueba en avatar.optimizar.test.cjs.
 */
test('avatar archivos: guarda exactamente el contenido recibido con claves diferentes', async () => {
  const escrituras = [];

  const almacenamiento = {
    async guardar(clave, entrada) {
      const fragmentos = [];

      for await (const fragmento of entrada) {
        fragmentos.push(fragmento);
      }

      escrituras.push({
        clave,
        contenido: Buffer.concat(fragmentos),
      });
    },
  };

  const service = new UsuariosAvatarArchivosService(almacenamiento);
  const contenido = Buffer.from('contenido optimizado de prueba');
  const copia = Buffer.from(contenido);

  const primera = await service.guardarOptimizado(contenido);
  const segunda = await service.guardarOptimizado(contenido);

  assert.notEqual(primera, segunda);
  assert.equal(escrituras.length, 2);

  for (const [indice, clave] of [primera, segunda].entries()) {
    assert.match(
      clave,
      /^avatares\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
    );

    assert.equal(escrituras[indice].clave, clave);
    assert.deepEqual(escrituras[indice].contenido, copia);
  }

  assert.deepEqual(contenido, copia);
});

test('avatar archivos: rechaza contenido vacío o incorrecto antes de escribir', async () => {
  let escrituras = 0;

  const service = new UsuariosAvatarArchivosService({
    async guardar() {
      escrituras += 1;
    },
  });

  for (const contenido of [Buffer.alloc(0), null, undefined, 'imagen']) {
    await assert.rejects(
      () => service.guardarOptimizado(contenido),
      {
        message:
          'El contenido optimizado del avatar debe ser un Buffer no vacío.',
      },
    );
  }

  assert.equal(escrituras, 0);
});

test('avatar archivos: propaga el fallo, libera el flujo y no elimina la clave', async () => {
  const errorEsperado = new Error('Escritura rechazada');
  let flujo;
  let eliminaciones = 0;

  const service = new UsuariosAvatarArchivosService({
    async guardar(clave, entrada) {
      flujo = entrada;
      throw errorEsperado;
    },

    async eliminar() {
      eliminaciones += 1;
    },
  });

  await assert.rejects(
    () => service.guardarOptimizado(Buffer.from('imagen')),
    (error) => error === errorEsperado,
  );

  assert.equal(flujo.destroyed, true);
  assert.equal(eliminaciones, 0);
});