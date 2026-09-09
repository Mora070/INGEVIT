require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ForbiddenException,
  UnauthorizedException,
} = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');

const {
  RolesGuard,
} = require('../dist/modules/auth/guards/roles.guard');

const {
  Roles,
} = require('../dist/modules/auth/decorators/roles.decorator');

/**
 * Construye un controlador independiente para cada prueba.
 * Aplica el decorador real sin necesitar sintaxis TypeScript.
 */
function crearEscenario({
  rolesControlador,
  rolesMetodo,
  usuario,
} = {}) {
  class ControladorPrueba {
    ejecutar() {}
  }

  if (rolesControlador !== undefined) {
    Roles(...rolesControlador)(ControladorPrueba);
  }

  if (rolesMetodo !== undefined) {
    const descriptor = Object.getOwnPropertyDescriptor(
      ControladorPrueba.prototype,
      'ejecutar',
    );

    Roles(...rolesMetodo)(
      ControladorPrueba.prototype,
      'ejecutar',
      descriptor,
    );
  }

  const request = {};

  if (usuario !== undefined) {
    request.usuario = usuario;
  }

  const context = {
    getHandler() {
      return ControladorPrueba.prototype.ejecutar;
    },
    getClass() {
      return ControladorPrueba;
    },
    switchToHttp() {
      return {
        getRequest() {
          return request;
        },
      };
    },
  };

  return {
    guard: new RolesGuard(new Reflector()),
    context,
    request,
  };
}

function crearUsuario(rol) {
  return {
    id_usuario: '10000000-0000-4000-8000-000000000001',
    rol,
    estado: 'ACTIVO',
  };
}

function comprobarPermisoRechazado(error) {
  assert.ok(error instanceof ForbiddenException);
  assert.equal(error.getStatus(), 403);
  assert.equal(
    error.message,
    'No tienes permisos para realizar esta operación.',
  );

  return true;
}

test('RolesGuard: permite al administrador acceder a una ruta administrativa', () => {
  const { guard, context } = crearEscenario({
    rolesMetodo: ['ADMINISTRADOR'],
    usuario: crearUsuario('ADMINISTRADOR'),
  });

  assert.equal(guard.canActivate(context), true);
});

test('RolesGuard: rechaza al usuario en una ruta administrativa', () => {
  const { guard, context } = crearEscenario({
    rolesMetodo: ['ADMINISTRADOR'],
    usuario: crearUsuario('USUARIO'),
  });

  assert.throws(
    () => guard.canActivate(context),
    comprobarPermisoRechazado,
  );
});

test('RolesGuard: exige identidad autenticada cuando hay una restricción', () => {
  const { guard, context } = crearEscenario({
    rolesMetodo: ['ADMINISTRADOR'],
  });

  assert.throws(
    () => guard.canActivate(context),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.equal(error.getStatus(), 401);
      assert.equal(
        error.message,
        'La sesión no es válida o ha expirado.',
      );
      return true;
    },
  );
});

test('RolesGuard: acepta cualquiera de los roles declarados', () => {
  for (const rol of ['ADMINISTRADOR', 'USUARIO']) {
    const { guard, context } = crearEscenario({
      rolesMetodo: ['ADMINISTRADOR', 'USUARIO'],
      usuario: crearUsuario(rol),
    });

    assert.equal(guard.canActivate(context), true);
  }
});

test('RolesGuard: aplica los roles del controlador cuando el método no declara otros', () => {
  const { guard, context } = crearEscenario({
    rolesControlador: ['ADMINISTRADOR'],
    usuario: crearUsuario('USUARIO'),
  });

  assert.throws(
    () => guard.canActivate(context),
    comprobarPermisoRechazado,
  );
});

test('RolesGuard: los roles del método reemplazan los del controlador', () => {
  const permitido = crearEscenario({
    rolesControlador: ['ADMINISTRADOR'],
    rolesMetodo: ['USUARIO'],
    usuario: crearUsuario('USUARIO'),
  });

  assert.equal(
    permitido.guard.canActivate(permitido.context),
    true,
  );

  const rechazado = crearEscenario({
    rolesControlador: ['ADMINISTRADOR'],
    rolesMetodo: ['USUARIO'],
    usuario: crearUsuario('ADMINISTRADOR'),
  });

  // Los roles no se combinan ni existe un acceso implícito por jerarquía.
  assert.throws(
    () => rechazado.guard.canActivate(rechazado.context),
    comprobarPermisoRechazado,
  );
});

test('RolesGuard: no añade restricciones cuando no hay roles declarados', () => {
  const { guard, context } = crearEscenario();

  /**
   * Este resultado no autentica la solicitud.
   * AuthGuard mantiene esa responsabilidad por separado.
   */
  assert.equal(guard.canActivate(context), true);
});

test('RolesGuard: ignora roles enviados en el cuerpo o los encabezados', () => {
  const { guard, context, request } = crearEscenario({
    rolesMetodo: ['ADMINISTRADOR'],
    usuario: crearUsuario('USUARIO'),
  });

  request.body = { rol: 'ADMINISTRADOR' };
  request.headers = { 'x-user-role': 'ADMINISTRADOR' };

  assert.throws(
    () => guard.canActivate(context),
    comprobarPermisoRechazado,
  );

  assert.equal(request.usuario.rol, 'USUARIO');
});