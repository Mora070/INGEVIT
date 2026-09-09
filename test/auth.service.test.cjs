require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');

const {
  AuthService,
} = require('../dist/modules/auth/auth.service');

const HASH_SIMULADO = 'HASH_SIMULADO_PARA_PRUEBAS';
const HASH_USUARIO = 'HASH_USUARIO_PARA_PRUEBAS';

/**
 * Datos ficticios exclusivos de las pruebas.
 * No se insertan registros ni se consulta PostgreSQL.
 */
function crearUsuario(cambios = {}) {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    password_hash: HASH_USUARIO,
    fecha_creacion: new Date('2026-09-08T10:30:00.000Z'),
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
    google_sub: null,
    ...cambios,
  };
}

/**
 * Construye el servicio con dependencias controladas.
 *
 * Registramos las llamadas para comprobar:
 * - Qué correo se consulta.
 * - Qué hash se verifica.
 * - Cuántas veces se genera el hash simulado.
 *
 * No conservamos el secreto aleatorio utilizado durante el arranque.
 */
function crearEscenario({
  usuario = crearUsuario(),
  coincide = true,
  errorBusqueda,
  errorVerificacion,
  errorGeneracion,
  errorEmision,
} = {}) {
  const llamadas = {
    correos: [],
    verificaciones: [],
    generaciones: 0,
    emisiones: [],
  };

  const usuariosService = {
    async buscarPorCorreoParaAutenticacion(correo) {
      llamadas.correos.push(correo);

      if (errorBusqueda) {
        throw errorBusqueda;
      }

      return usuario;
    },
  };

  const passwordService = {
    async generarHash() {
      llamadas.generaciones += 1;

      if (errorGeneracion) {
        throw errorGeneracion;
      }

      return HASH_SIMULADO;
    },

    async verificar(password, hash) {
      llamadas.verificaciones.push({ password, hash });

      if (errorVerificacion) {
        throw errorVerificacion;
      }

      return coincide;
    },
  };

/**
 * Registra cada intento de emisión.
 * Permite simular un fallo técnico después de validar las credenciales.
 */
const tokenService = {
  async emitirToken(idUsuario) {
    llamadas.emisiones.push(idUsuario);

    if (errorEmision) {
      throw errorEmision;
    }

    return 'TOKEN_FICTICIO_PARA_PRUEBAS';
  },
};

  return {
    service: new AuthService(
      usuariosService,
      passwordService,
      tokenService,
    ),
    llamadas,
  };
}

/**
 * Todos los rechazos de credenciales deben tener
 * el mismo estado y mensaje públicos.
 */
function comprobarCredencialesRechazadas(error) {
  assert.ok(error instanceof UnauthorizedException);
  assert.equal(error.getStatus(), 401);
  assert.equal(error.message, 'Correo o contraseña incorrectos.');

  return true;
}

test('AuthService: acepta credenciales válidas y devuelve únicamente el perfil seguro', async () => {
  const usuario = crearUsuario({
    google_sub: 'identidad-google-ficticia',
  });

  const { service, llamadas } = crearEscenario({ usuario });

  // Al instanciar manualmente, debemos ejecutar el ciclo de inicio.
  await service.onModuleInit();

  const resultado = await service.validarCredenciales(
    usuario.correo,
    'Clave ficticia',
  );

  assert.deepEqual(llamadas.correos, [usuario.correo]);

  assert.deepEqual(llamadas.verificaciones, [
    {
      password: 'Clave ficticia',
      hash: HASH_USUARIO,
    },
  ]);

  // La comparación exacta detecta campos sensibles adicionales.
  assert.deepEqual(resultado, {
    id_usuario: usuario.id_usuario,
    nombre: 'Persona',
    apellidos: 'De prueba',
    foto_perfil_url: null,
    correo: 'persona@example.test',
    telefono: null,
    fecha_creacion: '2026-09-08T10:30:00.000Z',
    ubicacion: null,
    rol: 'USUARIO',
    estado: 'ACTIVO',
  });
});

test('AuthService: rechaza una contraseña incorrecta', async () => {
  const { service, llamadas } = crearEscenario({
    coincide: false,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Contraseña incorrecta',
      ),
    comprobarCredencialesRechazadas,
  );

  assert.equal(llamadas.verificaciones.length, 1);
  assert.equal(llamadas.verificaciones[0].hash, HASH_USUARIO);
});

test('AuthService: rechaza una cuenta inactiva aunque la contraseña coincida', async () => {
  const { service, llamadas } = crearEscenario({
    usuario: crearUsuario({ estado: 'INACTIVO' }),
    coincide: true,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Clave ficticia',
      ),
    comprobarCredencialesRechazadas,
  );

  // La cuenta inactiva también realiza la verificación criptográfica.
  assert.equal(llamadas.verificaciones.length, 1);
  assert.equal(llamadas.verificaciones[0].hash, HASH_USUARIO);
});

test('AuthService: un correo inexistente utiliza el hash simulado y siempre se rechaza', async () => {
  const { service, llamadas } = crearEscenario({
    usuario: null,

    // Incluso si la comparación simulada devolviera true,
    // la ausencia de una cuenta debe impedir la autenticación.
    coincide: true,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'inexistente@example.test',
        'Clave ficticia',
      ),
    comprobarCredencialesRechazadas,
  );

  assert.deepEqual(llamadas.verificaciones, [
    {
      password: 'Clave ficticia',
      hash: HASH_SIMULADO,
    },
  ]);
});

test('AuthService: una cuenta exclusiva de Google utiliza el hash simulado y se rechaza por contraseña', async () => {
  const { service, llamadas } = crearEscenario({
    usuario: crearUsuario({
      password_hash: null,
      google_sub: 'identidad-google-ficticia',
    }),
    coincide: true,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Clave ficticia',
      ),
    comprobarCredencialesRechazadas,
  );

  assert.equal(llamadas.verificaciones.length, 1);
  assert.equal(llamadas.verificaciones[0].hash, HASH_SIMULADO);
});

test('AuthService: entrega la contraseña al verificador sin modificarla', async () => {
  const { service, llamadas } = crearEscenario();

  await service.onModuleInit();

  const password = '  Construcción-Ñ-🔐  ';

  await service.validarCredenciales(
    'persona@example.test',
    password,
  );

  assert.equal(llamadas.verificaciones[0].password, password);
});

test('AuthService: reutiliza el hash simulado entre intentos', async () => {
  const { service, llamadas } = crearEscenario({
    usuario: null,
    coincide: false,
  });

  await service.onModuleInit();

  for (let intento = 0; intento < 2; intento += 1) {
    await assert.rejects(
      () =>
        service.validarCredenciales(
          'inexistente@example.test',
          'Clave ficticia',
        ),
      comprobarCredencialesRechazadas,
    );
  }

  assert.equal(llamadas.generaciones, 1);
  assert.equal(llamadas.verificaciones.length, 2);

  for (const verificacion of llamadas.verificaciones) {
    assert.equal(verificacion.hash, HASH_SIMULADO);
  }
});

test('AuthService: propaga errores de búsqueda sin intentar verificar la contraseña', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const { service, llamadas } = crearEscenario({
    errorBusqueda: errorOriginal,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.equal(llamadas.verificaciones.length, 0);
});

test('AuthService: propaga los errores técnicos del verificador', async () => {
  const errorOriginal = new Error('Fallo criptográfico simulado');

  const { service } = crearEscenario({
    errorVerificacion: errorOriginal,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('AuthService: propaga un fallo al preparar el hash simulado', async () => {
  const errorOriginal = new Error('Fallo de inicialización simulado');

  const { service } = crearEscenario({
    errorGeneracion: errorOriginal,
  });

  await assert.rejects(
    () => service.onModuleInit(),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );
});

test('AuthService: impide validar credenciales antes de inicializarse', async () => {
  const { service, llamadas } = crearEscenario();

  await assert.rejects(
    () =>
      service.validarCredenciales(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        'El servicio de autenticación no se ha inicializado.',
      );
      return true;
    },
  );

  assert.equal(llamadas.correos.length, 0);
  assert.equal(llamadas.verificaciones.length, 0);
});

test('iniciarSesion: emite un token para el usuario autenticado y devuelve su perfil seguro', async () => {
  const usuario = crearUsuario();
  const { service, llamadas } = crearEscenario({ usuario });

  await service.onModuleInit();

  const resultado = await service.iniciarSesion(
    usuario.correo,
    'Clave ficticia',
  );

  assert.deepEqual(llamadas.correos, [usuario.correo]);

  assert.deepEqual(llamadas.verificaciones, [
    {
      password: 'Clave ficticia',
      hash: HASH_USUARIO,
    },
  ]);

  // La identidad utilizada para emitir procede del usuario consultado.
  assert.deepEqual(llamadas.emisiones, [usuario.id_usuario]);

  // El token forma parte del resultado interno, no del perfil.
  assert.deepEqual(resultado, {
    tokenAcceso: 'TOKEN_FICTICIO_PARA_PRUEBAS',
    usuario: {
      id_usuario: usuario.id_usuario,
      nombre: 'Persona',
      apellidos: 'De prueba',
      foto_perfil_url: null,
      correo: 'persona@example.test',
      telefono: null,
      fecha_creacion: '2026-09-08T10:30:00.000Z',
      ubicacion: null,
      rol: 'USUARIO',
      estado: 'ACTIVO',
    },
  });
});

/**
 * Cada motivo de rechazo debe impedir la emisión.
 * Mantenemos el mismo error público en todos los casos.
 */
const casosSinEmision = [
  {
    nombre: 'contraseña incorrecta',
    opciones: {
      coincide: false,
    },
  },
  {
    nombre: 'cuenta inactiva',
    opciones: {
      usuario: crearUsuario({ estado: 'INACTIVO' }),
      coincide: true,
    },
  },
  {
    nombre: 'correo inexistente',
    opciones: {
      usuario: null,
      coincide: true,
    },
  },
  {
    nombre: 'cuenta exclusiva de Google',
    opciones: {
      usuario: crearUsuario({
        password_hash: null,
        google_sub: 'identidad-google-ficticia',
      }),
      coincide: true,
    },
  },
];

for (const { nombre, opciones } of casosSinEmision) {
  test(`iniciarSesion: no emite un token ante ${nombre}`, async () => {
    const { service, llamadas } = crearEscenario(opciones);

    await service.onModuleInit();

    await assert.rejects(
      () =>
        service.iniciarSesion(
          'persona@example.test',
          'Clave ficticia',
        ),
      comprobarCredencialesRechazadas,
    );

    assert.deepEqual(llamadas.emisiones, []);
  });
}

test('iniciarSesion: no emite un token si falla la consulta del usuario', async () => {
  const errorOriginal = new Error('Fallo simulado de PostgreSQL');

  const { service, llamadas } = crearEscenario({
    errorBusqueda: errorOriginal,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.iniciarSesion(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.deepEqual(llamadas.verificaciones, []);
  assert.deepEqual(llamadas.emisiones, []);
});

test('iniciarSesion: no emite un token si falla la verificación criptográfica', async () => {
  const errorOriginal = new Error('Fallo criptográfico simulado');

  const { service, llamadas } = crearEscenario({
    errorVerificacion: errorOriginal,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.iniciarSesion(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  assert.equal(llamadas.verificaciones.length, 1);
  assert.deepEqual(llamadas.emisiones, []);
});

test('iniciarSesion: propaga un fallo de emisión sin devolver un resultado satisfactorio', async () => {
  const errorOriginal = new Error('Fallo simulado de firma');

  const { service, llamadas } = crearEscenario({
    errorEmision: errorOriginal,
  });

  await service.onModuleInit();

  await assert.rejects(
    () =>
      service.iniciarSesion(
        'persona@example.test',
        'Clave ficticia',
      ),
    (error) => {
      assert.strictEqual(error, errorOriginal);
      return true;
    },
  );

  // Las credenciales se validaron, pero la emisión falló.
  assert.equal(llamadas.verificaciones.length, 1);
  assert.deepEqual(llamadas.emisiones, [
  crearUsuario().id_usuario,
]);
});

/**
 * Identificador de la cuenta ficticia predeterminada.
 */
function ID_USUARIO_PARA_EMISION() {
  return crearUsuario().id_usuario;
}