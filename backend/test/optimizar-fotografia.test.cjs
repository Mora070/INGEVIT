require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const {
    optimizarFotografia,
} = require(
    '../dist/modules/fotografias/utils/optimizar-fotografia',
);

const {
    MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
    MAX_LADO_FOTOGRAFIA_OPTIMIZADA,
    MAX_BYTES_FOTOGRAFIA_ORIGINAL,
    CALIDADES_FOTOGRAFIA_OPTIMIZADA,
    ESCALAS_FOTOGRAFIA_OPTIMIZADA,
} = require(
    '../dist/modules/fotografias/config/procesamiento-fotografia.config',
);

/**
 * Genera una imagen de prueba sin acceder al disco.
 */
async function crearImagen(formato, width = 80, height = 40) {
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 30, g: 100, b: 180 },
        },
    })
        .toFormat(formato)
        .toBuffer();
}

/**
 * Comprueba las propiedades comunes de la versión web.
 *
 * Además de leer metadatos, decodifica el resultado para comprobar
 * que se pueda interpretar su contenido completo.
 */
async function comprobarSalida(contenido) {
    assert.ok(Buffer.isBuffer(contenido));
    assert.ok(contenido.length > 0);
    assert.ok(
        contenido.length <= MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
    );

    const metadatos = await sharp(contenido).metadata();

    assert.equal(metadatos.format, 'webp');
    assert.equal(metadatos.pages ?? 1, 1);
    assert.ok(metadatos.width <= MAX_LADO_FOTOGRAFIA_OPTIMIZADA);
    assert.ok(metadatos.height <= MAX_LADO_FOTOGRAFIA_OPTIMIZADA);

    await sharp(contenido).raw().toBuffer();

    return metadatos;
}

for (const formato of ['jpeg', 'png', 'webp']) {
    test(
        `optimizarFotografia: genera WebP desde ${formato} sin modificar el original`,
        async () => {
            const original = await crearImagen(formato);
            const copiaOriginal = Buffer.from(original);

            const optimizada = await optimizarFotografia(original);

            await comprobarSalida(optimizada);

            assert.notStrictEqual(optimizada, original);
            assert.deepEqual(original, copiaOriginal);
        },
    );
}

test(
    'optimizarFotografia: reduce una imagen grande conservando su proporción',
    async () => {
        const original = await crearImagen('jpeg', 3000, 1500);

        const optimizada = await optimizarFotografia(original);
        const metadatos = await comprobarSalida(optimizada);

        assert.equal(
            metadatos.width,
            MAX_LADO_FOTOGRAFIA_OPTIMIZADA,
        );
        assert.equal(
            metadatos.height,
            MAX_LADO_FOTOGRAFIA_OPTIMIZADA / 2,
        );
    },
);

test(
    'optimizarFotografia: no amplía una imagen pequeña ni impone un peso mínimo',
    async () => {
        const original = await crearImagen('png', 32, 16);

        const optimizada = await optimizarFotografia(original);
        const metadatos = await comprobarSalida(optimizada);

        assert.equal(metadatos.width, 32);
        assert.equal(metadatos.height, 16);
        assert.ok(optimizada.length < 2 * 1024 * 1024);
    },
);

test(
    'optimizarFotografia: conserva la transparencia de una imagen PNG',
    async () => {
        const original = await sharp({
            create: {
                width: 16,
                height: 16,
                channels: 4,
                background: {
                    r: 30,
                    g: 100,
                    b: 180,
                    alpha: 0.5,
                },
            },
        })
            .png()
            .toBuffer();

        const optimizada = await optimizarFotografia(original);
        const metadatos = await comprobarSalida(optimizada);

        assert.equal(metadatos.hasAlpha, true);

        const { data, info } = await sharp(optimizada)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        assert.equal(info.channels, 4);

        // El primer píxel debe seguir siendo parcialmente transparente.
        assert.ok(data[3] > 0);
        assert.ok(data[3] < 255);
    },
);

test(
    'optimizarFotografia: aplica la orientación EXIF sin modificar los metadatos del original',
    async () => {
        const original = await sharp({
            create: {
                width: 80,
                height: 40,
                channels: 3,
                background: { r: 30, g: 100, b: 180 },
            },
        })
            .withMetadata({ orientation: 6 })
            .jpeg()
            .toBuffer();

        const copiaOriginal = Buffer.from(original);
        const metadatosOriginales = await sharp(original).metadata();

        // Confirma que la imagen de prueba contiene la orientación esperada.
        assert.equal(metadatosOriginales.orientation, 6);
        assert.equal(metadatosOriginales.width, 80);
        assert.equal(metadatosOriginales.height, 40);

        const optimizada = await optimizarFotografia(original);
        const metadatos = await comprobarSalida(optimizada);

        // Orientación 6: giro de 90 grados; ancho y alto se intercambian.
        assert.equal(metadatos.width, 40);
        assert.equal(metadatos.height, 80);
        assert.equal(metadatos.orientation, undefined);
        assert.equal(metadatos.exif, undefined);

        assert.deepEqual(original, copiaOriginal);
        assert.equal(
            (await sharp(original).metadata()).orientation,
            6,
        );
    },
);

test(
    'optimizarFotografia: rechaza un original superior a 20 MiB',
    async () => {
        const original = Buffer.alloc(
            MAX_BYTES_FOTOGRAFIA_ORIGINAL + 1,
        );

        await assert.rejects(
            optimizarFotografia(original),
            (error) => {
                assert.equal(error.getStatus(), 413);
                assert.equal(
                    error.message,
                    'La fotografía no puede superar 20 MiB.',
                );

                return true;
            },
        );
    },
);

test(
    'optimizarFotografia: no convierte un formato de entrada no permitido',
    async () => {
        const original = await crearImagen('tiff');
        const copiaOriginal = Buffer.from(original);

        await assert.rejects(
            optimizarFotografia(original),
            (error) => {
                assert.equal(error.getStatus(), 415);
                assert.equal(
                    error.message,
                    'Solo se permiten fotografías JPG, JPEG, PNG y WebP.',
                );

                return true;
            },
        );

        assert.deepEqual(original, copiaOriginal);
    },
);

test(
    'optimizarFotografia: rechaza un WebP animado sin convertirlo silenciosamente a estático',
    async () => {
        const fotogramas = await Promise.all(
            [
                { r: 255, g: 0, b: 0 },
                { r: 0, g: 0, b: 255 },
            ].map((background) =>
                sharp({
                    create: {
                        width: 16,
                        height: 16,
                        channels: 3,
                        background,
                    },
                })
                    .png()
                    .toBuffer(),
            ),
        );

        const original = await sharp(fotogramas, {
            join: { animated: true },
        })
            .webp({
                lossless: true,
                loop: 0,
                delay: [100, 100],
            })
            .toBuffer();

        const copiaOriginal = Buffer.from(original);

        // La prueba debe partir de un archivo realmente animado.
        const metadatos = await sharp(original).metadata();
        assert.equal(metadatos.format, 'webp');
        assert.equal(metadatos.pages, 2);

        await assert.rejects(
            optimizarFotografia(original),
            (error) => {
                assert.equal(error.getStatus(), 400);
                assert.equal(
                    error.message,
                    'Solo se aceptan fotografías estáticas.',
                );

                return true;
            },
        );

        assert.deepEqual(original, copiaOriginal);
    },
);

test(
    'optimizarFotografia: reintenta cuando el resultado supera el máximo y se detiene al cumplirlo',
    async (t) => {
        // Generamos el original antes de simular la codificación.
        const original = await crearImagen('png');
        const copiaOriginal = Buffer.from(original);

        const resultadoGrande = Buffer.alloc(
            MAX_BYTES_FOTOGRAFIA_OPTIMIZADA + 1,
        );
        const resultadoAceptable = Buffer.from('Resultado simulado.');

        /*
         * Solo sustituimos toBuffer. La inspección inicial mediante
         * metadata continúa utilizando el original real.
         *
         * Estos buffers representan tamaños, no imágenes WebP válidas.
         */
        let intentos = 0;

        const codificacion = t.mock.method(
            sharp.prototype,
            'toBuffer',
            async () => {
                intentos += 1;

                // Primera codificación: excede el límite.
                // Segunda codificación: cumple el tamaño requerido.
                return intentos === 1
                    ? resultadoGrande
                    : resultadoAceptable;
            },
        );

        const resultado = await optimizarFotografia(original);

        assert.strictEqual(resultado, resultadoAceptable);
        assert.equal(codificacion.mock.callCount(), 2);
        assert.deepEqual(original, copiaOriginal);
    },
);

test(
    'optimizarFotografia: acepta un resultado exactamente igual al máximo permitido',
    async (t) => {
        const original = await crearImagen('png');

        const resultadoEnLimite = Buffer.alloc(
            MAX_BYTES_FOTOGRAFIA_OPTIMIZADA,
        );

        const codificacion = t.mock.method(
            sharp.prototype,
            'toBuffer',
            async () => resultadoEnLimite,
        );

        const resultado = await optimizarFotografia(original);

        assert.strictEqual(resultado, resultadoEnLimite);
        assert.equal(codificacion.mock.callCount(), 1);
    },
);

test(
    'optimizarFotografia: limita los intentos y responde 422 si ninguna combinación cumple el tamaño',
    async (t) => {
        const original = await crearImagen('png');

        const resultadoGrande = Buffer.alloc(
            MAX_BYTES_FOTOGRAFIA_OPTIMIZADA + 1,
        );

        const codificacion = t.mock.method(
            sharp.prototype,
            'toBuffer',
            async () => resultadoGrande,
        );

        await assert.rejects(
            optimizarFotografia(original),
            (error) => {
                assert.equal(error.getStatus(), 422);
                assert.equal(
                    error.message,
                    'No se pudo generar una versión optimizada de hasta 3 MiB con los parámetros configurados.',
                );

                return true;
            },
        );

        const intentosEsperados =
            CALIDADES_FOTOGRAFIA_OPTIMIZADA.length
            * ESCALAS_FOTOGRAFIA_OPTIMIZADA.length;

        assert.equal(
            codificacion.mock.callCount(),
            intentosEsperados,
        );
    },
);

test(
    'optimizarFotografia: no reintenta un fallo de procesamiento ni expone su detalle interno',
    async (t) => {
        const original = await crearImagen('png');
        const detalleInterno = 'DETALLE_INTERNO_DEL_CODIFICADOR';

        const codificacion = t.mock.method(
            sharp.prototype,
            'toBuffer',
            async () => {
                throw new Error(detalleInterno);
            },
        );

        await assert.rejects(
            optimizarFotografia(original),
            (error) => {
                assert.equal(error.getStatus(), 400);
                assert.equal(
                    error.message,
                    'No se pudo procesar la fotografía recibida.',
                );
                assert.equal(
                    JSON.stringify(error.getResponse()).includes(detalleInterno),
                    false,
                );

                return true;
            },
        );

        assert.equal(codificacion.mock.callCount(), 1);
    },
);