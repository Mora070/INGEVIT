# Fotografía de perfil

## Comportamiento

- Formatos de entrada: JPG/JPEG, PNG y WebP estáticos.
- Tamaño máximo de entrada: 5 MiB.
- Se guarda únicamente una versión optimizada WebP.
- Dimensiones máximas: 512 × 512 píxeles.
- Se conserva la proporción y no se amplían imágenes pequeñas.
- El original no se almacena.
- Sin fotografía, foto_perfil_url es null; el frontend muestra iniciales.

## Rutas

Todas requieren una sesión válida.

### POST /api/usuarios/me/avatar

Recibe multipart/form-data con un único archivo llamado archivo.
No acepta campos de texto.

Respuesta HTTP 200:

{
  "foto_perfil_url": "/api/usuarios/<id_usuario>/avatar"
}

La identidad procede de la sesión. No se puede modificar el avatar
de otra cuenta mediante parámetros del cliente.

### GET /api/usuarios/:idUsuario/avatar

Entrega image/webp.

Permite consultar el avatar propio o el de otra cuenta activa
con la que se comparta un proyecto activo cuyo propietario esté activo.

Sin fotografía o sin permiso devuelve HTTP 404.
Sin sesión válida devuelve HTTP 401.

La respuesta utiliza Cache-Control: no-store.

### DELETE /api/usuarios/me/avatar

Retira la fotografía del perfil autenticado.

Respuesta HTTP 200:

{
  "foto_perfil_url": null
}

Repetir la operación cuando no existe fotografía es válido.

## Persistencia y limpieza

Cada archivo utiliza una clave nueva: avatares/<uuid>.webp.

La sustitución bloquea la cuenta y actualiza la referencia junto con
la tarea de eliminación del archivo anterior en una misma transacción.

El trabajador comprueba las referencias antes de eliminar un archivo.
Las cuentas inactivas también protegen sus archivos referenciados.

Dos sustituciones simultáneas se serializan mediante el bloqueo de
la cuenta. El avatar vigente no se registra para eliminación.

## Fallos

Si falla el registro y la transacción se revierte, se intenta eliminar
el archivo nuevo.

Si el resultado de la transacción es incierto, se conserva el archivo
para evitar eliminar uno que PostgreSQL podría haber referenciado.

La reconciliación automática de esos archivos inciertos queda pendiente.
Si también falla la compensación, se propagan ambos errores.

## Validación existente

- Optimización y almacenamiento.
- Coordinación y compensación de errores.
- Referencias de cuentas activas e inactivas.
- Atomicidad de actualización y limpieza.
- Permisos entre participantes.
- Flujo HTTP de subida, descarga, reemplazo y retirada.
- Sustituciones concurrentes.