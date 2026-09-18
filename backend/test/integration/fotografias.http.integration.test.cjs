require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const {
  conAplicacionReal,
} = require('../helpers/con-aplicacion-real.cjs');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  PasswordService,
} = require('../../dist/modules/auth/services/password.service');

const {
  AUTH_COOKIE_NAME,
} = require('../../dist/modules/auth/auth-cookie.config');

const {
  ArchivosPendientesService,
} = require('../../dist/modules/almacenamiento/archivos-pendientes.service');

test(
  'fotografías HTTP: inicia sesión, sube, descarga y edita con componentes reales',
  async () => {
    await conAplicacionReal(
      async ({ app, baseUrl, origen, raizTemporal }) => {
        const database = app.get(DatabaseService);
        const passwords = app.get(PasswordService);

        const idUsuario = randomUUID();
        const idProyecto = randomUUID();
        const correo = `${idUsuario}@example.invalid`;
        const password = 'Clave temporal de integración-2026';
        const hash = await passwords.generarHash(password);

        let clavesDeLaPrueba = [];

        try {
          /*
           * Confirmamos la preparación para que las peticiones HTTP
           * puedan consultar estos datos desde sus conexiones.
           */
          await database.withTransaction(async (client) => {
            await client.query(
              `
                INSERT INTO obra.usuarios (
                  id_usuario,
                  correo,
                  password_hash
                )
                VALUES ($1, $2, $3)
              `,
              [idUsuario, correo, hash],
            );

            await client.query(
              `
                INSERT INTO obra.proyectos (
                  id_proyecto,
                  id_propietario,
                  nombre,
                  descripcion,
                  direccion,
                  contratante,
                  fecha_inicio,
                  estado_proyecto
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `,
              [
                idProyecto,
                idUsuario,
                'Proyecto temporal HTTP',
                'Prueba completa de fotografías',
                'Dirección temporal',
                'Contratante temporal',
                '2026-09-14',
                'ACTIVA',
              ],
            );
          });

          // 1. Login HTTP con Argon2, JWT y PostgreSQL reales.
          const login = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              Origin: origen,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ correo, password }),
          });

          const perfil = await login.json();

          assert.equal(login.status, 200);
          assert.equal(perfil.id_usuario, idUsuario);

          const cookieSesion = login.headers
            .getSetCookie()
            .find((valor) =>
              valor.startsWith(`${AUTH_COOKIE_NAME}=`),
            );

          assert.ok(cookieSesion, 'El login debe emitir la cookie de sesión.');

          /*
           * fetch de Node no conserva automáticamente las cookies.
           * Enviamos solo nombre=valor; los atributos de Set-Cookie
           * no forman parte del encabezado Cookie.
           */
          const cookie = cookieSesion.split(';')[0];

          const original = await sharp({
            create: {
              width: 64,
              height: 32,
              channels: 3,
              background: { r: 30, g: 110, b: 180 },
            },
          })
            .jpeg()
            .toBuffer();

          const formulario = new FormData();
          formulario.append('titulo', 'Fotografía HTTP');

          formulario.append(
            'archivo',
            new Blob([original], { type: 'image/jpeg' }),
            'obra.jpg',
          );

          // 2. Subida autenticada por multipart.
          const subida = await fetch(
            `${baseUrl}/api/proyectos/${idProyecto}/fotografias`,
            {
              method: 'POST',
              headers: {
                Origin: origen,
                Cookie: cookie,
              },
              body: formulario,
            },
          );

          const fotografia = await subida.json();

          assert.equal(subida.status, 201);
          assert.equal(fotografia.titulo, 'Fotografía HTTP');
          assert.equal(Object.hasOwn(fotografia, 's3_key'), false);
          assert.equal(Object.hasOwn(fotografia, 'original_s3_key'), false);

          const urlDescarga = new URL(fotografia.url, baseUrl);

          // La URL devuelta debe permanecer dentro de este backend.
          assert.equal(urlDescarga.origin, baseUrl);

          // 3. La URL no permite acceso sin sesión.
          const sinSesion = await fetch(urlDescarga);
          await sinSesion.json();

          assert.equal(sinSesion.status, 401);

          // 4. Descarga autenticada mediante el guard real.
          const descarga = await fetch(urlDescarga, {
            headers: { Cookie: cookie },
          });

          const recibido = Buffer.from(
            await descarga.arrayBuffer(),
          );

          assert.equal(descarga.status, 200);
          assert.equal(
            descarga.headers.get('content-type'),
            'image/webp',
          );
          assert.equal(
            descarga.headers.get('cache-control'),
            'no-store',
          );

          // 5. Contrastamos la respuesta con PostgreSQL y los archivos.
          const registros = await database.query(
            `
              SELECT id_fotografia, id_usuario_subida,
                     s3_key, original_s3_key
              FROM obra.fotografias
              WHERE id_proyecto = $1
            `,
            [idProyecto],
          );

          assert.equal(registros.rowCount, 1);

          const registro = registros.rows[0];

          clavesDeLaPrueba = [
            registro.original_s3_key,
            registro.s3_key,
          ];

          assert.equal(
            registro.id_fotografia,
            fotografia.id_fotografia,
          );
          assert.equal(registro.id_usuario_subida, idUsuario);

          const optimizadaGuardada = await readFile(
            path.join(raizTemporal, ...registro.s3_key.split('/')),
          );

          const originalGuardado = await readFile(
            path.join(
              raizTemporal,
              ...registro.original_s3_key.split('/'),
            ),
          );

          assert.deepEqual(recibido, optimizadaGuardada);
          assert.deepEqual(originalGuardado, original);

          const metadata = await sharp(recibido).metadata();
          assert.equal(metadata.format, 'webp');

          const actividades = await database.query(
            `
              SELECT id_actor, tipo_accion
              FROM obra.actividades
              WHERE id_proyecto = $1
            `,
            [idProyecto],
          );

          assert.deepEqual(actividades.rows, [
            {
              id_actor: idUsuario,
              tipo_accion: 'FOTOGRAFIA_SUBIDA',
            },
          ]);

          // 6. Guardamos el estado completo antes de intentar editar.
          const consultarFotografia = async () => {
            const resultado = await database.query(
              `
      SELECT *
      FROM obra.fotografias
      WHERE id_fotografia = $1
    `,
              [fotografia.id_fotografia],
            );

            assert.equal(resultado.rowCount, 1);
            return resultado.rows[0];
          };

          const antesDeEditar = await consultarFotografia();

          const urlEdicion =
            `${baseUrl}/api/proyectos/${idProyecto}` +
            `/fotografias/${fotografia.id_fotografia}/titulo`;

          // 7. Una sesión válida no evita la comprobación del origen.
          const origenRechazado = await fetch(urlEdicion, {
            method: 'PATCH',
            headers: {
              Origin: 'http://origen-no-permitido.invalid',
              Cookie: cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              titulo: 'Este título no debe guardarse',
            }),
          });

          await origenRechazado.json();

          assert.equal(origenRechazado.status, 403);
          assert.deepEqual(await consultarFotografia(), antesDeEditar);

          // 8. Sin cookie, el origen permitido no concede acceso.
          const edicionSinSesion = await fetch(urlEdicion, {
            method: 'PATCH',
            headers: {
              Origin: origen,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              titulo: 'Este título tampoco debe guardarse',
            }),
          });

          await edicionSinSesion.json();

          assert.equal(edicionSinSesion.status, 401);
          assert.deepEqual(await consultarFotografia(), antesDeEditar);

          // Los intentos rechazados no deben generar actividades.
          const historialAntes = await database.query(
            `
    SELECT tipo_accion
    FROM obra.actividades
    WHERE id_proyecto = $1
  `,
            [idProyecto],
          );

          assert.deepEqual(historialAntes.rows, [
            { tipo_accion: 'FOTOGRAFIA_SUBIDA' },
          ]);

          // 9. La sesión y el origen válidos permiten guardar el título.
          const tituloNuevo = 'Avance actualizado por HTTP';

          const edicion = await fetch(urlEdicion, {
            method: 'PATCH',
            headers: {
              Origin: origen,
              Cookie: cookie,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ titulo: tituloNuevo }),
          });

          const editada = await edicion.json();

          assert.equal(edicion.status, 200);
          assert.equal(edicion.headers.get('cache-control'), 'no-store');

          // La respuesta pública solo cambia en el título.
          assert.deepEqual(editada, {
            ...fotografia,
            titulo: tituloNuevo,
          });

          // PostgreSQL conserva todos los demás campos.
          assert.deepEqual(await consultarFotografia(), {
            ...antesDeEditar,
            titulo: tituloNuevo,
          });

          const historialFinal = await database.query(
            `
    SELECT id_actor, tipo_accion, mensaje
    FROM obra.actividades
    WHERE id_proyecto = $1
  `,
            [idProyecto],
          );

          assert.equal(historialFinal.rowCount, 2);

          const guardados = historialFinal.rows.filter(
            (actividad) =>
              actividad.tipo_accion === 'FOTOGRAFIA_TITULO_GUARDADO',
          );

          assert.deepEqual(guardados, [
            {
              id_actor: idUsuario,
              tipo_accion: 'FOTOGRAFIA_TITULO_GUARDADO',
              mensaje:
                `Título de la fotografía ${fotografia.id_fotografia} guardado.`,
            },
          ]);

          // La edición no modifica ninguna de las dos versiones del archivo.
          assert.deepEqual(
            await readFile(
              path.join(raizTemporal, ...registro.s3_key.split('/')),
            ),
            optimizadaGuardada,
          );

          assert.deepEqual(
            await readFile(
              path.join(raizTemporal, ...registro.original_s3_key.split('/')),
            ),
            originalGuardado,
          );

          // Eliminación HTTP con sesión y origen válidos.
          const urlEliminacion =
            `${baseUrl}/api/proyectos/${idProyecto}` +
            `/fotografias/${fotografia.id_fotografia}`;

          const eliminacion = await fetch(urlEliminacion, {
            method: 'DELETE',
            headers: {
              Origin: origen,
              Cookie: cookie,
            },
          });

          assert.equal(eliminacion.status, 204);
          assert.equal(await eliminacion.text(), '');

          const fotografiaEliminada = await database.query(
            `
    SELECT id_fotografia
    FROM obra.fotografias
    WHERE id_fotografia = $1
  `,
            [fotografia.id_fotografia],
          );

          assert.equal(fotografiaEliminada.rowCount, 0);

          const tareasDeBorrado = await database.query(
            `
    SELECT s3_key
    FROM obra.archivos_pendientes_eliminacion
    WHERE s3_key = ANY($1::text[])
    ORDER BY s3_key
  `,
            [clavesDeLaPrueba],
          );

          assert.deepEqual(
            tareasDeBorrado.rows.map((fila) => fila.s3_key),
            [...clavesDeLaPrueba].sort(),
          );

          /*
           * El trabajador está desactivado en conAplicacionReal.
           * La respuesta 204 no significa que los archivos ya se borraron.
           */
          assert.deepEqual(
            await readFile(
              path.join(raizTemporal, ...registro.s3_key.split('/')),
            ),
            optimizadaGuardada,
          );

          assert.deepEqual(
            await readFile(
              path.join(raizTemporal, ...registro.original_s3_key.split('/')),
            ),
            originalGuardado,
          );

          // Aunque el archivo físico existe, la descarga autorizada deja de estar disponible.
          const descargaPosterior = await fetch(urlDescarga, {
            headers: { Cookie: cookie },
          });

          await descargaPosterior.json();
          assert.equal(descargaPosterior.status, 404);

          // Repetir la eliminación no debe crear tareas ni actividades adicionales.
          const eliminacionRepetida = await fetch(urlEliminacion, {
            method: 'DELETE',
            headers: {
              Origin: origen,
              Cookie: cookie,
            },
          });

          await eliminacionRepetida.json();
          assert.equal(eliminacionRepetida.status, 404);

          const actividadesEliminacion = await database.query(
            `
    SELECT id_actor, tipo_accion, mensaje
    FROM obra.actividades
    WHERE id_proyecto = $1
      AND tipo_accion = 'FOTOGRAFIA_ELIMINADA'
  `,
            [idProyecto],
          );

          assert.deepEqual(actividadesEliminacion.rows, [
            {
              id_actor: idUsuario,
              tipo_accion: 'FOTOGRAFIA_ELIMINADA',
              mensaje: `Fotografía ${fotografia.id_fotografia} eliminada.`,
            },
          ]);

          const pendientesFinales = await database.query(
            `
    SELECT s3_key
    FROM obra.archivos_pendientes_eliminacion
    WHERE s3_key = ANY($1::text[])
    ORDER BY s3_key
  `,
            [clavesDeLaPrueba],
          );

          assert.deepEqual(pendientesFinales.rows, tareasDeBorrado.rows);
          /*
* El procesador selecciona tareas de la cola completa.
* Verificamos que no haya pendientes ajenos antes de ejecutarlo.
*/
          const tareasAjenas = await database.query(
            `
    SELECT s3_key
    FROM obra.archivos_pendientes_eliminacion
    WHERE NOT (s3_key = ANY($1::text[]))
  `,
            [clavesDeLaPrueba],
          );

          assert.equal(
            tareasAjenas.rowCount,
            0,
            'La prueba no debe procesar tareas ajenas.',
          );

          const procesador = app.get(ArchivosPendientesService);

          // Una tarea por cada versión: original y optimizada.
          assert.equal(
            await procesador.procesarSiguienteConReintento(60),
            true,
          );

          assert.equal(
            await procesador.procesarSiguienteConReintento(60),
            true,
          );

          const tareasTrasProcesar = await database.query(
            `
    SELECT s3_key
    FROM obra.archivos_pendientes_eliminacion
    WHERE s3_key = ANY($1::text[])
  `,
            [clavesDeLaPrueba],
          );

          assert.equal(tareasTrasProcesar.rowCount, 0);

          // Ambas versiones físicas deben haber desaparecido.
          for (const clave of clavesDeLaPrueba) {
            await assert.rejects(
              () => readFile(
                path.join(raizTemporal, ...clave.split('/')),
              ),
              { code: 'ENOENT' },
            );
          }

          assert.equal(
            await procesador.procesarSiguienteConReintento(60),
            false,
          );

          // La actividad de eliminación permanece después del borrado físico.
          const actividadConservada = await database.query(
            `
    SELECT id_actor, tipo_accion, mensaje
    FROM obra.actividades
    WHERE id_proyecto = $1
      AND tipo_accion = 'FOTOGRAFIA_ELIMINADA'
  `,
            [idProyecto],
          );

          assert.deepEqual(
            actividadConservada.rows,
            actividadesEliminacion.rows,
          );

        } finally {
          /*
           * Limpiamos únicamente los UUID de esta prueba.
           * El proyecto se elimina primero para liberar sus relaciones.
           * El ayudante cerrará la aplicación y borrará la carpeta temporal.
           */
          await database.withTransaction(async (client) => {
            await client.query(
              'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
              [idProyecto],
            );

            /*
             * La cola no tiene una relación en cascada con el proyecto.
             * Retiramos únicamente las tareas creadas por esta prueba.
             */
            await client.query(
              `
        DELETE FROM obra.archivos_pendientes_eliminacion
        WHERE s3_key = ANY($1::text[])
      `,
              [clavesDeLaPrueba],
            );

            await client.query(
              'DELETE FROM obra.usuarios WHERE id_usuario = $1',
              [idUsuario],
            );
          });

        }

      },
    );
  },
);