require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  ProyectosService,
} = require('../dist/modules/proyectos/proyectos.service');

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearProyecto(cambios = {}) {
  return {
    id_proyecto: '20000000-0000-4000-8000-000000000002',
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: '4.7110',
    longitud: '-74.0721',
    ...cambios,
  };
}

test('listarDisponibles: transmite la identidad y la paginación y devuelve proyectos transformados', async () => {
  const llamadas = [];

  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario(
      idUsuario,
      pagina,
      limite,
    ) {
      llamadas.push({ idUsuario, pagina, limite });

      return {
        proyectos: [
          crearProyecto({
            campo_interno: 'NO_DEBE_DEVOLVERSE',
          }),
        ],
        total: 45,
      };
    },
  });

  const resultado = await service.listarDisponibles(
    ID_USUARIO,
    { pagina: 3, limite: 20 },
  );

  assert.deepEqual(llamadas, [
    {
      idUsuario: ID_USUARIO,
      pagina: 3,
      limite: 20,
    },
  ]);

  assert.deepEqual(resultado, {
    proyectos: [
      {
        id_proyecto: '20000000-0000-4000-8000-000000000002',
        id_propietario: ID_USUARIO,
        nombre: 'Proyecto de prueba',
        descripcion: 'Descripción de prueba',
        direccion: 'Dirección de prueba',
        contratante: 'Cliente de prueba',
        fecha_inicio: '2026-09-09',
        fecha_finalizacion: null,
        estado_proyecto: 'ACTIVA',
        activo: true,
        latitud: 4.711,
        longitud: -74.0721,
      },
    ],
    pagina: 3,
    limite: 20,
    total: 45,
    total_paginas: 3,
  });
});

test('listarDisponibles: devuelve cero páginas cuando no hay proyectos accesibles', async () => {
  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      return { proyectos: [], total: 0 };
    },
  });

  const resultado = await service.listarDisponibles(
    ID_USUARIO,
    { pagina: 1, limite: 20 },
  );

  assert.deepEqual(resultado, {
    proyectos: [],
    pagina: 1,
    limite: 20,
    total: 0,
    total_paginas: 0,
  });
});

test('listarDisponibles: conserva la página solicitada y el total cuando no hay filas en esa página', async () => {
  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      return { proyectos: [], total: 45 };
    },
  });

  const resultado = await service.listarDisponibles(
    ID_USUARIO,
    { pagina: 10, limite: 20 },
  );

  assert.deepEqual(resultado, {
    proyectos: [],
    pagina: 10,
    limite: 20,
    total: 45,
    total_paginas: 3,
  });
});

test('listarDisponibles: no agrega una página cuando el total es múltiplo del límite', async () => {
  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      return {
        proyectos: [crearProyecto()],
        total: 40,
      };
    },
  });

  const resultado = await service.listarDisponibles(
    ID_USUARIO,
    { pagina: 1, limite: 20 },
  );

  assert.equal(resultado.total_paginas, 2);
});

test('listarDisponibles: conserva el orden recibido y las ubicaciones nulas', async () => {
  const primero = crearProyecto({
    id_proyecto: '30000000-0000-4000-8000-000000000003',
    latitud: null,
    longitud: null,
  });

  const segundo = crearProyecto();

  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      return {
        proyectos: [primero, segundo],
        total: 2,
      };
    },
  });

  const resultado = await service.listarDisponibles(
    ID_USUARIO,
    { pagina: 1, limite: 20 },
  );

  assert.deepEqual(
    resultado.proyectos.map((proyecto) => proyecto.id_proyecto),
    [primero.id_proyecto, segundo.id_proyecto],
  );

  assert.equal(resultado.proyectos[0].latitud, null);
  assert.equal(resultado.proyectos[0].longitud, null);
});

test('listarDisponibles: no modifica la consulta ni los datos del repositorio', async () => {
  const consulta = { pagina: 1, limite: 20 };
  const datos = {
    proyectos: [crearProyecto()],
    total: 1,
  };

  const consultaOriginal = structuredClone(consulta);
  const datosOriginales = structuredClone(datos);

  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      return datos;
    },
  });

  await service.listarDisponibles(ID_USUARIO, consulta);

  assert.deepEqual(consulta, consultaOriginal);
  assert.deepEqual(datos, datosOriginales);
});

test('listarDisponibles: propaga los errores del repositorio', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const service = new ProyectosService({
    async findDisponiblesPaginadosByUsuario() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      service.listarDisponibles(
        ID_USUARIO,
        { pagina: 1, limite: 20 },
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('obtenerDetalle: consulta con la identidad recibida y devuelve el proyecto transformado', async () => {
  const fila = crearProyecto({
    campo_interno: 'NO_DEBE_DEVOLVERSE',
  });
  const llamadas = [];

  const service = new ProyectosService({
    async findDisponibleById(idProyecto, idUsuario) {
      llamadas.push({ idProyecto, idUsuario });
      return fila;
    },
  });

  const resultado = await service.obtenerDetalle(
    fila.id_proyecto,
    ID_USUARIO,
  );

  assert.deepEqual(llamadas, [
    {
      idProyecto: fila.id_proyecto,
      idUsuario: ID_USUARIO,
    },
  ]);

  assert.deepEqual(resultado, {
    id_proyecto: fila.id_proyecto,
    id_propietario: ID_USUARIO,
    nombre: 'Proyecto de prueba',
    descripcion: 'Descripción de prueba',
    direccion: 'Dirección de prueba',
    contratante: 'Cliente de prueba',
    fecha_inicio: '2026-09-09',
    fecha_finalizacion: null,
    estado_proyecto: 'ACTIVA',
    activo: true,
    latitud: 4.711,
    longitud: -74.0721,
  });
});

test('obtenerDetalle: devuelve 404 cuando el repositorio no encuentra un proyecto disponible', async () => {
  const service = new ProyectosService({
    async findDisponibleById() {
      return null;
    },
  });

  await assert.rejects(
    () =>
      service.obtenerDetalle(
        crearProyecto().id_proyecto,
        ID_USUARIO,
      ),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.getStatus(), 404);
      assert.equal(
        error.message,
        'El proyecto no está disponible.',
      );
      return true;
    },
  );
});

test('obtenerDetalle: propaga un error de PostgreSQL sin convertirlo en 404', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const service = new ProyectosService({
    async findDisponibleById() {
      throw errorOriginal;
    },
  });

  await assert.rejects(
    () =>
      service.obtenerDetalle(
        crearProyecto().id_proyecto,
        ID_USUARIO,
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('obtenerDetalle: no modifica el registro recibido', async () => {
  const fila = crearProyecto();
  const original = structuredClone(fila);

  const service = new ProyectosService({
    async findDisponibleById() {
      return fila;
    },
  });

  const resultado = await service.obtenerDetalle(
    fila.id_proyecto,
    ID_USUARIO,
  );

  assert.deepEqual(fila, original);
  assert.notStrictEqual(resultado, fila);
});