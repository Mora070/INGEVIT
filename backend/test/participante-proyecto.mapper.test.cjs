require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapearParticipanteProyecto,
} = require(
  '../dist/modules/proyectos/mappers/participante-proyecto.mapper',
);

const ID_USUARIO = '10000000-0000-4000-8000-000000000001';

function crearParticipante(cambios = {}) {
  return {
    id_usuario: ID_USUARIO,
    nombre: 'Nombre de prueba',
    apellidos: 'Apellido de prueba',
    foto_perfil_url: 'https://example.invalid/perfil.jpg',
    participacion: 'PROPIETARIO',
    ...cambios,
  };
}

test(
  'mapearParticipanteProyecto: devuelve únicamente los campos públicos',
  () => {
    /*
     * Simulamos un registro con propiedades adicionales.
     * Aunque TypeScript defina una interfaz, en ejecución un objeto
     * puede contener más campos que los declarados.
     */
    const participante = crearParticipante({
      correo: 'prueba@example.invalid',
      password_hash: 'HASH_FICTICIO_NO_PUBLICABLE',
      google_sub: 'IDENTIFICADOR_FICTICIO_NO_PUBLICABLE',
      rol: 'ADMINISTRADOR',
      estado: 'ACTIVO',
    });

    const resultado = mapearParticipanteProyecto(participante);

    assert.deepEqual(resultado, {
      id_usuario: ID_USUARIO,
      nombre: 'Nombre de prueba',
      apellidos: 'Apellido de prueba',
      foto_perfil_url: 'https://example.invalid/perfil.jpg',
      participacion: 'PROPIETARIO',
    });
  },
);

test(
  'mapearParticipanteProyecto: devuelve un objeto nuevo sin modificar el original',
  () => {
    const participante = crearParticipante();
    const copiaAnterior = { ...participante };

    const resultado = mapearParticipanteProyecto(participante);

    assert.notStrictEqual(resultado, participante);
    assert.deepEqual(participante, copiaAnterior);

    // Modificar la respuesta no debe modificar el registro recibido.
    resultado.nombre = 'Nombre modificado en la respuesta';

    assert.deepEqual(participante, copiaAnterior);
  },
);

test(
  'mapearParticipanteProyecto: conserva los campos nulos de un perfil incompleto',
  () => {
    const participante = crearParticipante({
      nombre: null,
      apellidos: null,
      foto_perfil_url: null,
      participacion: 'COLABORADOR',
    });

    assert.deepEqual(
      mapearParticipanteProyecto(participante),
      {
        id_usuario: ID_USUARIO,
        nombre: null,
        apellidos: null,
        foto_perfil_url: null,
        participacion: 'COLABORADOR',
      },
    );
  },
);

test(
  'mapearParticipanteProyecto: conserva la participación sin sustituirla por el rol global',
  () => {
    const participante = crearParticipante({
      participacion: 'COLABORADOR',
      rol: 'ADMINISTRADOR',
    });

    const resultado = mapearParticipanteProyecto(participante);

    assert.equal(resultado.participacion, 'COLABORADOR');
    assert.equal(Object.hasOwn(resultado, 'rol'), false);
  },
);