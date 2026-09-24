require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');

const {
    SubirCapaDto,
} = require('../dist/modules/capas/dto/subir-capa.dto');

const {
    createValidationPipe,
} = require('../dist/common/pipes/create-validation-pipe');

function validar(datos) {
    return createValidationPipe().transform(datos, {
        type: 'body',
        metatype: SubirCapaDto,
    });
}

function esSolicitudInvalida(error) {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.getStatus(), 400);
    return true;
}

test('subir capa: normaliza el nombre sin modificar la entrada', async () => {
    const datos = Object.freeze({
        nombre: '  Ortofoto del proyecto  ',
        descripcion: 'Levantamiento de septiembre.',
    });

    const resultado = await validar(datos);

    assert.ok(resultado instanceof SubirCapaDto);
    assert.deepEqual({ ...resultado }, {
        nombre: 'Ortofoto del proyecto',
        descripcion: 'Levantamiento de septiembre.',
    });
    assert.equal(datos.nombre, '  Ortofoto del proyecto  ');
});

test('subir capa: permite omitir la descripción', async () => {
    const resultado = await validar({
        nombre: 'Ortofoto',
    });

    assert.equal(resultado.descripcion, '');
});

test('subir capa: conserva el contenido de la descripción', async () => {
    for (const descripcion of [
        '',
        '  Observaciones del levantamiento.  ',
        'Primera línea.\nSegunda línea: Bogotá, construcción.',
    ]) {
        const resultado = await validar({
            nombre: 'Ortofoto',
            descripcion,
        });

        assert.equal(resultado.descripcion, descripcion);
    }
});

test('subir capa: exige un nombre de texto con contenido', async () => {
    for (const nombre of [
        undefined,
        null,
        '',
        '   ',
        '\t\n',
        123,
        true,
        {},
        ['Ortofoto'],
    ]) {
        await assert.rejects(
            validar({ nombre }),
            esSolicitudInvalida,
        );
    }
});

test('subir capa: rechaza descripciones de tipos incorrectos', async () => {
    for (const descripcion of [
        null,
        123,
        false,
        {},
        ['Descripción'],
    ]) {
        await assert.rejects(
            validar({ nombre: 'Ortofoto', descripcion }),
            esSolicitudInvalida,
        );
    }
});

test('subir capa: rechaza caracteres nulos incompatibles con PostgreSQL', async () => {
    for (const datos of [
        { nombre: 'Orto\0foto' },
        { nombre: 'Ortofoto', descripcion: 'Texto\0inválido' },
    ]) {
        await assert.rejects(
            validar(datos),
            esSolicitudInvalida,
        );
    }
});

test('subir capa: impide que el cliente asigne campos administrados por el backend', async () => {
    for (const extra of [
        { id_capa: 'otra-capa' },
        { id_proyecto: 'otro-proyecto' },
        { id_usuario_subida: 'otro-usuario' },
        { nombre_archivo_original: 'original.tif' },
        { almacenamiento_proveedor: 'S3' },
        { original_key: 'capas/otra.tif' },
        { tamano_original_bytes: '1024' },
        { crs_original: 'EPSG:4326' },
        { bbox: [-74.1, 4.6, -74, 4.7] },
        { bbox_oeste: -74.1 },
        { bbox_sur: 4.6 },
        { bbox_este: -74 },
        { bbox_norte: 4.7 },
        { estado_procesamiento: 'LISTA' },
        { mapbox_source_id: 'fuente' },
        { mapbox_tileset_id: 'cuenta.tileset' },
        { mapbox_job_id: 'trabajo' },
        { error_procesamiento: 'error' },
        { fecha_creacion: '2026-01-01' },
        { opacidad: 0.5 },
        { visible: false },
        { orden: 3 },
    ]) {
        await assert.rejects(
            validar({ nombre: 'Ortofoto', ...extra }),
            esSolicitudInvalida,
        );
    }
});