require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const {
    Body,
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
} = require('@nestjs/common');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
    mkdtemp,
    readFile,
    readdir,
    rm,
} = require('node:fs/promises');

const {
    crearInterceptorSubidaCapa,
} = require('../dist/modules/capas/interceptors/subida-capa.interceptor');
const {
    SubirCapaDto,
} = require('../dist/modules/capas/dto/subir-capa.dto');
const {
    createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

/**
 * Aplicación exclusiva de prueba.
 * Comprueba el transporte y la limpieza; no interpreta un GeoTIFF real.
 */
test('subida de capa HTTP: recibe multipart y limpia temporales en éxito y error', async () => {
    const raiz = await mkdtemp(
        join(tmpdir(), 'ingevit-capa-http-test-'),
    );

    let app;
    let llamadas = 0;

    class ControladorPrueba {
        async subir(archivo, datos) {
            llamadas += 1;

            if (datos.nombre === 'Provocar error') {
                throw new Error('Fallo controlado de procesamiento');
            }

            const contenido = await readFile(archivo.path);

            return {
                nombre: datos.nombre,
                descripcion: datos.descripcion,
                bytes: archivo.size,
                contenido: contenido.toString('utf8'),
            };
        }

        deshabilitada() {
            throw new Error('Esta operación no debe ejecutarse');
        }
    }

    Controller('capas-prueba')(ControladorPrueba);

    const descriptor = Object.getOwnPropertyDescriptor(
        ControladorPrueba.prototype,
        'subir',
    );

    Post()(ControladorPrueba.prototype, 'subir', descriptor);
    UploadedFile()(ControladorPrueba.prototype, 'subir', 0);
    Body()(ControladorPrueba.prototype, 'subir', 1);

    Reflect.defineMetadata(
        'design:paramtypes',
        [Object, SubirCapaDto],
        ControladorPrueba.prototype,
        'subir',
    );

    UseInterceptors(
        crearInterceptorSubidaCapa({
            habilitada: true,
            maxArchivoBytes: 10,
        }, raiz),
    )(ControladorPrueba.prototype, 'subir', descriptor);

    const deshabilitada = Object.getOwnPropertyDescriptor(
        ControladorPrueba.prototype,
        'deshabilitada',
    );

    Post('deshabilitada')(
        ControladorPrueba.prototype,
        'deshabilitada',
        deshabilitada,
    );

    UseInterceptors(
        crearInterceptorSubidaCapa({
            habilitada: false,
            maxArchivoBytes: null,
        }, raiz),
    )(
        ControladorPrueba.prototype,
        'deshabilitada',
        deshabilitada,
    );

    try {
        const modulo = await Test.createTestingModule({
            controllers: [ControladorPrueba],
        }).compile();

        app = modulo.createNestApplication();
        app.useLogger(false);
        app.useGlobalPipes(createValidationPipe());
        await app.listen(0, '127.0.0.1');

        const baseUrl = await app.getUrl();

        function formulario({
            nombre = '  Ortofoto  ',
            contenido = '0123456789',
            incluirArchivo = true,
            segundoArchivo = false,
            extra = false,
        } = {}) {
            const datos = new FormData();

            datos.append('nombre', nombre);
            datos.append('descripcion', 'Descripción de prueba');

            if (extra) {
                datos.append('estado_procesamiento', 'LISTA');
            }

            if (incluirArchivo) {
                datos.append(
                    'archivo',
                    new Blob([contenido]),
                    'original.tif',
                );
            }

            if (segundoArchivo) {
                datos.append(
                    'archivo',
                    new Blob(['otro']),
                    'segundo.tif',
                );
            }

            return datos;
        }

        async function enviar(body, estadoEsperado, ruta = '') {
            const respuesta = await fetch(
                `${baseUrl}/capas-prueba${ruta}`,
                {
                    method: 'POST',
                    body,
                },
            );

            const cuerpo = await respuesta.json();

            assert.equal(
                respuesta.status,
                estadoEsperado,
                JSON.stringify(cuerpo),
            );

            // La limpieza debe haber terminado antes de recibir la respuesta.
            assert.deepEqual(await readdir(raiz), []);

            return cuerpo;
        }

        const correcta = await enviar(formulario(), 201);

        assert.deepEqual(correcta, {
            nombre: 'Ortofoto',
            descripcion: 'Descripción de prueba',
            bytes: 10,
            contenido: '0123456789',
        });
        assert.equal(llamadas, 1);

        await enviar(formulario({ incluirArchivo: false }), 400);
        await enviar(formulario({ contenido: '' }), 400);
        await enviar(formulario({ contenido: '01234567890' }), 413);
        await enviar(formulario({ segundoArchivo: true }), 400);
        await enviar(formulario({ extra: true }), 400);

        // Falla el DTO después de haber recibido el archivo.
        await enviar(formulario({ nombre: '   ' }), 400);
        assert.equal(llamadas, 1);

        // Falla el procesamiento después de validar los campos.
        await enviar(formulario({ nombre: 'Provocar error' }), 500);
        assert.equal(llamadas, 2);

        await enviar(formulario(), 503, '/deshabilitada');

        // También rechaza peticiones que no sean multipart.
        await enviar('contenido sin multipart', 400);
        assert.equal(llamadas, 2);
    } finally {
        try {
            await app?.close();
        } finally {
            await rm(raiz, { recursive: true, force: true });
        }
    }
});