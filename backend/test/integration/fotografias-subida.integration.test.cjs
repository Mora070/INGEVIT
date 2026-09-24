require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const sharp = require('sharp');

const {
  DatabaseService,
} = require('../../dist/database/database.service');

const {
  AlmacenamientoLocalService,
} = require('../../dist/modules/almacenamiento/almacenamiento-local.service');

const {
  FotografiasArchivosService,
} = require('../../dist/modules/fotografias/fotografias-archivos.service');

const {
  FotografiasPersistenciaService,
} = require('../../dist/modules/fotografias/fotografias-persistencia.service');

const {
  FotografiasAccesoRepository,
} = require('../../dist/modules/fotografias/fotografias-acceso.repository');

const {
  FotografiasRepository,
} = require('../../dist/modules/fotografias/fotografias.repository');

const {
  FotografiasSubidaService,
} = require('../../dist/modules/fotografias/fotografias-subida.service');

const {
  ActividadesRepository,
} = require('../../dist/modules/actividades/actividades.repository');

const {
  FotografiasDescargaRepository,
} = require('../../dist/modules/fotografias/fotografias-descarga.repository');

const {
  FotografiasDescargaService,
} = require('../../dist/modules/fotografias/fotografias-descarga.service');

/**
 * Comprueba la coordinación real entre:
 *
 * - Autorización del colaborador.
 * - Procesamiento de la imagen.
 * - Escritura de ambas versiones.
 * - Inserción de fotografía y actividad.
 * - Confirmación de la transacción.
 *
 * No prueba todavía el transporte HTTP ni la descarga por URL.
 */
test(
  'subir: un colaborador guarda ambas versiones y registra fotografía y actividad',
  async () => {
    const raizTemporal = await mkdtemp(
      path.join(tmpdir(), 'ingevit-subida-integracion-'),
    );

    const raizAnterior = process.env.STORAGE_LOCAL_ROOT;

    const idPropietario = randomUUID();
    const idColaborador = randomUUID();
    const idProyecto = randomUUID();

    let database;

    try {
      process.env.STORAGE_LOCAL_ROOT = raizTemporal;

      database = new DatabaseService();
      await database.onModuleInit();

      const almacenamiento = new AlmacenamientoLocalService();
      await almacenamiento.onModuleInit();

      const archivos = new FotografiasArchivosService(almacenamiento);

      const persistencia = new FotografiasPersistenciaService(
        database,
        archivos,
      );

      const servicio = new FotografiasSubidaService(
        database,
        new FotografiasAccesoRepository(),
        persistencia,
        new FotografiasRepository(),
        new ActividadesRepository(),
      );

      /*
       * Confirmamos los datos de preparación para que las transacciones
       * del servicio puedan consultarlos desde sus propias conexiones.
       *
       * Son cuentas exclusivas de Google de prueba: no necesitan
       * contraseñas ni credenciales reales.
       */
      await database.withTransaction(async (client) => {
        await client.query(
          `
            INSERT INTO obra.usuarios (
              id_usuario,
              correo,
              google_sub
            )
            VALUES
              ($1, $2, $3),
              ($4, $5, $6)
          `,
          [
            idPropietario,
            `${idPropietario}@example.invalid`,
            `integracion-${idPropietario}`,
            idColaborador,
            `${idColaborador}@example.invalid`,
            `integracion-${idColaborador}`,
          ],
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
            idPropietario,
            'Proyecto temporal de integración',
            'Prueba de subida de fotografías',
            'Dirección temporal',
            'Contratante temporal',
            '2026-09-11',
            'ACTIVA',
          ],
        );

        await client.query(
          `
            INSERT INTO obra.usuario_proyecto (
              id_usuario,
              id_proyecto
            )
            VALUES ($1, $2)
          `,
          [idColaborador, idProyecto],
        );
      });

      // Generamos una imagen válida sin depender de archivos externos.
      const original = await sharp({
        create: {
          width: 320,
          height: 180,
          channels: 3,
          background: { r: 40, g: 100, b: 160 },
        },
      })
        .jpeg({ quality: 95 })
        .toBuffer();

      const copiaOriginal = Buffer.from(original);
      const titulo = 'Avance de obra';

      const respuesta = await servicio.subir(
        idProyecto,
        idColaborador,
        {
          titulo,
          latitud: 4.711,
          longitud: -74.0721,
        },
        original,
      );

      /*
       * Consultamos después de terminar el servicio.
       * Así verificamos que el registro quedó confirmado.
       */
      const resultado = await database.query(
        `
    SELECT
      id_fotografia,
      id_proyecto,
      id_usuario_subida,
      titulo,
      latitud,
      longitud,
      url,
      s3_key,
      original_s3_key,
      fecha_subida
    FROM obra.fotografias
    WHERE id_proyecto = $1
  `,
        [idProyecto],
      );

      assert.equal(resultado.rowCount, 1);

      const fotografia = resultado.rows[0];

      // pg devuelve las columnas numeric como texto.
      // Comprobamos la ubicación guardada después del COMMIT.
      assert.notEqual(fotografia.latitud, null);
      assert.notEqual(fotografia.longitud, null);
      assert.equal(Number(fotografia.latitud), 4.711);
      assert.equal(Number(fotografia.longitud), -74.0721);

      assert.equal(fotografia.id_proyecto, idProyecto);
      assert.equal(fotografia.id_usuario_subida, idColaborador);
      assert.equal(fotografia.titulo, titulo);

      assert.match(
        fotografia.original_s3_key,
        /^fotografias\/[0-9a-f-]+\.jpeg$/,
      );

      assert.match(
        fotografia.s3_key,
        /^fotografias\/[0-9a-f-]+\.webp$/,
      );

      assert.notEqual(
        fotografia.original_s3_key,
        fotografia.s3_key,
      );

      const nombreOptimizado = fotografia.s3_key.split('/')[1];

      assert.equal(
        fotografia.url,
        `/api/proyectos/${idProyecto}/fotografias/archivos/${nombreOptimizado}`,
      );

      // El cliente recibe el recurso optimizado y no las claves internas.
      assert.equal(respuesta.id_fotografia, fotografia.id_fotografia);
      assert.equal(respuesta.url, fotografia.url);
      assert.equal(respuesta.titulo, titulo);
      assert.equal(
        respuesta.fecha_subida,
        fotografia.fecha_subida.toISOString(),
      );

      assert.equal(Object.hasOwn(respuesta, 's3_key'), false);
      assert.equal(Object.hasOwn(respuesta, 'original_s3_key'), false);

      const originalGuardado = await readFile(
        path.join(
          raizTemporal,
          ...fotografia.original_s3_key.split('/'),
        ),
      );

      const optimizadaGuardada = await readFile(
        path.join(
          raizTemporal,
          ...fotografia.s3_key.split('/'),
        ),
      );

      // El respaldo conserva exactamente los bytes recibidos.
      assert.deepEqual(originalGuardado, copiaOriginal);
      assert.deepEqual(original, copiaOriginal);

      assert.ok(optimizadaGuardada.length > 0);
      assert.ok(optimizadaGuardada.length <= 3 * 1024 * 1024);

      /*
 * Recuperamos la fotografía mediante el servicio de descarga.
 *
 * El repositorio utiliza PostgreSQL real para comprobar el acceso
 * del colaborador; el almacenamiento abre el archivo real.
 */
      const descargaService = new FotografiasDescargaService(
        new FotografiasDescargaRepository(database),
        almacenamiento,
      );

      // Tomamos el nombre de la URL pública que devolvió la subida.
      const urlPublica = new URL(
        respuesta.url,
        'http://127.0.0.1:3000',
      );

      const nombreArchivo = decodeURIComponent(
        urlPublica.pathname.split('/').pop(),
      );

      assert.equal(nombreArchivo, nombreOptimizado);

      const flujoDescarga = await descargaService.abrirOptimizada(
        idProyecto,
        idColaborador,
        nombreArchivo,
      );

      const fragmentos = [];

      try {
        for await (const fragmento of flujoDescarga) {
          fragmentos.push(Buffer.from(fragmento));
        }
      } finally {
        // Liberamos el recurso incluso si la lectura falla.
        flujoDescarga.destroy();
      }

      const contenidoDescargado = Buffer.concat(fragmentos);

      // La descarga entrega exactamente la versión optimizada almacenada.
      assert.deepEqual(contenidoDescargado, optimizadaGuardada);

      // El respaldo original sigue intacto después de la descarga.
      assert.deepEqual(
        await readFile(
          path.join(
            raizTemporal,
            ...fotografia.original_s3_key.split('/'),
          ),
        ),
        copiaOriginal,
      );

      const metadata = await sharp(optimizadaGuardada).metadata();

      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 320);
      assert.equal(metadata.height, 180);

      // Una subida debe producir exactamente dos archivos.
      const nombresGuardados = await readdir(
        path.join(raizTemporal, 'fotografias'),
      );

      assert.deepEqual(
        nombresGuardados.sort(),
        [
          fotografia.original_s3_key.split('/')[1],
          nombreOptimizado,
        ].sort(),
      );

      const actividades = await database.query(
        `
          SELECT id_actor, tipo_accion, mensaje
          FROM obra.actividades
          WHERE id_proyecto = $1
        `,
        [idProyecto],
      );

      assert.equal(actividades.rowCount, 1);

      assert.deepEqual(actividades.rows[0], {
        id_actor: idColaborador,
        tipo_accion: 'FOTOGRAFIA_SUBIDA',
        mensaje: `Fotografía ${fotografia.id_fotografia} subida.`,
      });
    } finally {
      /*
       * Eliminamos únicamente los UUID de esta prueba.
       *
       * Primero el proyecto: sus fotografías, colaboradores y actividades
       * se eliminan mediante las relaciones existentes.
       * Después se eliminan las cuentas temporales.
       */
      try {
        if (database) {
          await database.withTransaction(async (client) => {
            await client.query(
              'DELETE FROM obra.proyectos WHERE id_proyecto = $1',
              [idProyecto],
            );

            await client.query(
              `
                DELETE FROM obra.usuarios
                WHERE id_usuario IN ($1, $2)
              `,
              [idPropietario, idColaborador],
            );
          });
        }
      } finally {
        try {
          if (database) {
            await database.onApplicationShutdown();
          }
        } finally {
          if (raizAnterior === undefined) {
            delete process.env.STORAGE_LOCAL_ROOT;
          } else {
            process.env.STORAGE_LOCAL_ROOT = raizAnterior;
          }

          // Solo se borra la carpeta exclusiva creada con mkdtemp.
          await rm(raizTemporal, { recursive: true, force: true });
        }
      }
    }
  },
);