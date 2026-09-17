require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  TokenService,
} = require('../../dist/modules/auth/services/token.service');

const {
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

/**
 * Comprueba rutas, autenticación, procesamiento y persistencia reales.
 *
 * El ayudante desactiva los trabajadores y utiliza una carpeta temporal.
 * Las sesiones se emiten con TokenService; AuthGuard permanece activo.
 */
test('avatar HTTP: valida, optimiza, descarga, reemplaza y retira la fotografía', async () => {
  await conAplicacionReal(async ({
    app,
    baseUrl,
    origen,
    raizTemporal,
  }) => {
    const database = app.get(DatabaseService);
    const tokens = app.get(TokenService);
    const id = randomUUID();
    const directorio = path.join(raizTemporal, 'avatares');
    const urlAvatar = `/api/usuarios/${id}/avatar`;
    let cookie;

    async function consultarReferencia() {
      const resultado = await database.query(
        `
          SELECT foto_perfil_url, foto_perfil_key
          FROM obra.usuarios
          WHERE id_usuario = $1
        `,
        [id],
      );

      assert.equal(resultado.rowCount, 1);
      return resultado.rows[0];
    }

    async function subir(contenido, {
      nombre = 'foto.png',
      tipo = 'image/png',
      sesion = cookie,
    } = {}) {
      const formulario = new FormData();
      formulario.append(
        'archivo',
        new Blob([contenido], { type: tipo }),
        nombre,
      );

      return fetch(`${baseUrl}/api/usuarios/me/avatar`, {
        method: 'POST',
        headers: {
          Origin: origen,
          ...(sesion ? { Cookie: sesion } : {}),
        },
        body: formulario,
      });
    }

    async function esperarEstado(response, esperado) {
      const texto = await response.text();
      assert.equal(response.status, esperado, texto);
      return texto;
    }

    try {
      await database.query(
        `
          INSERT INTO obra.usuarios (id_usuario, correo, google_sub)
          VALUES ($1, $2, $3)
        `,
        [id, `${id}@example.invalid`, `avatar-http-${id}`],
      );

      const token = await tokens.emitirTokenConVersion(id, 0);
      cookie = `${AUTH_COOKIE_NAME}=${token}`;

      const imagen = await sharp({
        create: {
          width: 1000,
          height: 600,
          channels: 3,
          background: '#336699',
        },
      }).png().toBuffer();

      // Ninguna ruta permite operar sin sesión.
      await esperarEstado(await subir(imagen, { sesion: null }), 401);

      await esperarEstado(
        await fetch(`${baseUrl}${urlAvatar}`),
        401,
      );

      await esperarEstado(
        await fetch(`${baseUrl}/api/usuarios/me/avatar`, {
          method: 'DELETE',
          headers: { Origin: origen },
        }),
        401,
      );

      // Sin fotografía, la descarga autenticada devuelve 404.
      await esperarEstado(
        await fetch(`${baseUrl}${urlAvatar}`, {
          headers: { Cookie: cookie },
        }),
        404,
      );

      // El tamaño se limita durante la recepción.
      await esperarEstado(
        await subir(Buffer.alloc(5 * 1024 * 1024 + 1)),
        413,
      );

      // La extensión y el MIME no convierten un SVG en una fotografía.
      await esperarEstado(
        await subir(Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
        )),
        415,
      );

      assert.deepEqual(await readdir(directorio), []);
      assert.deepEqual(await consultarReferencia(), {
        foto_perfil_url: null,
        foto_perfil_key: null,
      });

      // Primera subida: se guarda exclusivamente el WebP optimizado.
      const primeraRespuesta = await subir(imagen);
      assert.equal(primeraRespuesta.status, 200);
      assert.equal(
        primeraRespuesta.headers.get('cache-control'),
        'no-store',
      );
      assert.deepEqual(await primeraRespuesta.json(), {
        foto_perfil_url: urlAvatar,
      });

      const primera = await consultarReferencia();
      const primerNombre = primera.foto_perfil_key.split('/')[1];

      assert.deepEqual(await readdir(directorio), [primerNombre]);

      const archivo = await readFile(path.join(directorio, primerNombre));
      const metadata = await sharp(archivo).metadata();

      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 512);
      assert.ok(metadata.height > 0 && metadata.height <= 512);
      assert.equal(metadata.exif, undefined);

      const descarga = await fetch(`${baseUrl}${urlAvatar}`, {
        headers: { Cookie: cookie },
      });

      assert.equal(descarga.status, 200);
      assert.match(descarga.headers.get('content-type'), /^image\/webp/);
      assert.equal(descarga.headers.get('cache-control'), 'no-store');
      assert.equal(
        descarga.headers.get('x-content-type-options'),
        'nosniff',
      );
      assert.deepEqual(
        Buffer.from(await descarga.arrayBuffer()),
        archivo,
      );

      // Reemplazo con una imagen pequeña: no debe ampliarse.
      const pequena = await sharp({
        create: {
          width: 80,
          height: 40,
          channels: 3,
          background: '#994433',
        },
      }).jpeg().toBuffer();

      await esperarEstado(
        await subir(pequena, {
          nombre: 'pequena.jpeg',
          tipo: 'image/jpeg',
        }),
        200,
      );

      const segunda = await consultarReferencia();
      assert.notEqual(segunda.foto_perfil_key, primera.foto_perfil_key);

      const segundoArchivo = await readFile(
        path.join(directorio, segunda.foto_perfil_key.split('/')[1]),
      );
      const segundaMetadata = await sharp(segundoArchivo).metadata();

      assert.equal(segundaMetadata.format, 'webp');
      assert.equal(segundaMetadata.width, 80);
      assert.equal(segundaMetadata.height, 40);

      const pendientesTrasReemplazo = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
        `,
        [[primera.foto_perfil_key, segunda.foto_perfil_key]],
      );

      assert.deepEqual(pendientesTrasReemplazo.rows, [
        { s3_key: primera.foto_perfil_key },
      ]);

      // Retirar devuelve null y deja de permitir la descarga.
      const retirada = await fetch(
        `${baseUrl}/api/usuarios/me/avatar`,
        {
          method: 'DELETE',
          headers: { Origin: origen, Cookie: cookie },
        },
      );

      assert.equal(retirada.status, 200);
      assert.deepEqual(await retirada.json(), { foto_perfil_url: null });
      assert.deepEqual(await consultarReferencia(), {
        foto_perfil_url: null,
        foto_perfil_key: null,
      });

      await esperarEstado(
        await fetch(`${baseUrl}${urlAvatar}`, {
          headers: { Cookie: cookie },
        }),
        404,
      );

      // Repetir la retirada no crea otra tarea.
      await esperarEstado(
        await fetch(`${baseUrl}/api/usuarios/me/avatar`, {
          method: 'DELETE',
          headers: { Origin: origen, Cookie: cookie },
        }),
        200,
      );

      const pendientesFinales = await database.query(
        `
          SELECT s3_key
          FROM obra.archivos_pendientes_eliminacion
          WHERE s3_key = ANY($1::text[])
          ORDER BY s3_key
        `,
        [[primera.foto_perfil_key, segunda.foto_perfil_key]],
      );

      assert.deepEqual(
        pendientesFinales.rows.map((fila) => fila.s3_key),
        [primera.foto_perfil_key, segunda.foto_perfil_key].sort(),
      );
    } finally {
      /*
       * La carpeta pertenece exclusivamente a esta prueba.
       * Sus archivos identifican las posibles tareas que debemos retirar,
       * incluso si una comprobación anterior falló.
       */
      const nombres = await readdir(directorio);
      const claves = nombres.map((nombre) => `avatares/${nombre}`);

      await database.withTransaction(async (client) => {
        await client.query(
          'DELETE FROM obra.usuarios WHERE id_usuario = $1',
          [id],
        );

        await client.query(
          `
            DELETE FROM obra.archivos_pendientes_eliminacion
            WHERE s3_key = ANY($1::text[])
          `,
          [claves],
        );
      });
    }
  });
});