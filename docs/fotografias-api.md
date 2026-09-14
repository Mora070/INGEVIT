# API de fotografías

## Autenticación y permisos

Las rutas requieren una sesión autenticada mediante la cookie
ingevit_access_token.

El acceso requiere:
- Solicitante activo.
- Proyecto activo.
- Propietario del proyecto activo.
- Solicitante propietario o colaborador del proyecto.

El rol global ADMINISTRADOR no concede acceso a proyectos ajenos.

Las solicitudes POST deben incluir un Origin permitido por la
configuración del backend.

## Subir una fotografía

POST /api/proyectos/:idProyecto/fotografias

Content-Type: multipart/form-data

Campos:
- titulo: texto obligatorio y no vacío.
- archivo: un archivo obligatorio.

No se aceptan campos adicionales, como id_usuario_subida.
La identidad del usuario procede exclusivamente de la sesión.

El cliente debe permitir que su biblioteca HTTP genere el encabezado
multipart y su boundary. No debe construirlo manualmente.

### Archivos

Formatos admitidos:
- JPEG, incluyendo archivos con extensión .jpg o .jpeg.
- PNG.
- WebP estático.

Tamaño máximo del original: 20 MiB = 20 971 520 bytes.
El tamaño máximo es inclusivo.

La validación interpreta el contenido del archivo; no confía
únicamente en su extensión o en el MIME enviado por el cliente.

Se conservan dos versiones:
- Original: mismos bytes recibidos.
- Optimizada: WebP de hasta 3 MiB.

La optimización reduce resolución y comprime cuando corresponde,
sin ampliar imágenes pequeñas. No existe un tamaño mínimo:
una imagen optimizada puede pesar menos de 2 MiB.

La detección de fotografías animadas debe rechazar la subida con:
"Solo se aceptan fotografías estáticas."

### Resultado

HTTP 201 con los metadatos públicos de la fotografía.

El campo url identifica la versión optimizada y tiene esta estructura:

/api/proyectos/:idProyecto/fotografias/archivos/:nombreArchivo

La respuesta no incluye s3_key ni original_s3_key.

La URL es relativa al backend. Conocerla no sustituye la autenticación.

### Errores

- 400: formulario inválido, archivo ausente o vacío, varios archivos,
  imagen ilegible o animación detectada.
- 401: sesión ausente, inválida o expirada.
- 403: origen rechazado por la protección global.
- 404: proyecto inexistente o no disponible para el solicitante.
- 413: original superior a 20 MiB.
- 415: formato no admitido.
- 422: no fue posible generar la versión optimizada dentro del límite.
- 500: fallo interno.

No se garantiza un orden concreto de errores cuando una petición
incumple varias condiciones simultáneamente.

## Consultar fotografías

GET /api/proyectos/:idProyecto/fotografias

Parámetros:
- pagina: predeterminado 1.
- limite: predeterminado 20; máximo 100.

Devuelve los metadatos paginados de las fotografías disponibles.

## Leer la versión optimizada

GET /api/proyectos/:idProyecto/fotografias/archivos/:nombreArchivo

nombreArchivo corresponde a un UUID en minúsculas con extensión .webp,
generado por el backend.

Respuesta correcta:
- HTTP 200.
- Content-Type: image/webp.
- Content-Disposition: inline.
- Cache-Control: no-store.
- X-Content-Type-Options: nosniff.
- Cuerpo binario de la imagen.

El backend comprueba los permisos antes de abrir el archivo.
Esta ruta no permite descargar el original de respaldo.

Si el cliente se desconecta durante la transferencia, se destruye
el flujo de lectura.

Un fallo anterior al envío puede producir una respuesta de error JSON.
Un fallo durante la transferencia puede interrumpir la conexión:
el cliente no debe considerar completa una descarga interrumpida.


## Editar el título de una fotografía

PATCH /api/proyectos/:idProyecto/fotografias/:idFotografia/titulo

Content-Type: application/json

Cuerpo:

{
  "titulo": "Avance de cimentación"
}

El título es obligatorio y debe ser un texto no vacío.
No se recortan espacios automáticamente.
No se admiten propiedades adicionales.

### Permisos

Pueden realizar la operación el propietario y los colaboradores
activos de un proyecto disponible.

Un colaborador retirado pierde el permiso.
El rol ADMINISTRADOR no concede acceso a un proyecto ajeno.

La solicitud requiere una sesión válida y un Origin permitido.

### Resultado

HTTP 200 con los metadatos públicos actualizados.
Cache-Control: no-store.

Solo cambia el título. Se conservan:
- Autor original.
- Proyecto.
- Fecha de subida.
- URL de la versión optimizada.
- Referencias y contenido de ambos archivos.

La autorización, la actualización y la actividad se ejecutan
en una misma transacción de PostgreSQL.

La actividad identifica al usuario que realizó el guardado,
que puede ser distinto del autor de la fotografía.

Cada guardado correcto registra FOTOGRAFIA_TITULO_GUARDADO,
incluso cuando el título recibido coincide con el existente.

### Errores

- 400: identificadores o cuerpo inválidos.
- 401: sesión ausente, inválida o expirada.
- 403: origen no permitido.
- 404: proyecto o fotografía no disponibles para el solicitante.
- 500: fallo interno.

Si falla el registro de actividad, la transacción revierte
también el cambio de título.

Los intentos rechazados por falta de acceso no modifican
la fotografía ni generan actividad.

## Persistencia y recuperación

La fotografía y su actividad se registran en una misma transacción
de PostgreSQL.

Los archivos se almacenan fuera de PostgreSQL.

Si falla el registro y la reversión está confirmada, se intenta
eliminar las versiones creadas para esa subida.

Si el resultado de la transacción es desconocido, se conservan los
archivos para evitar eliminar contenido que podría estar registrado.

No existe atomicidad conjunta entre PostgreSQL y el almacenamiento.

## Pendientes técnicos

- Reconciliación de archivos conservados ante transacciones inciertas
  y archivos huérfanos por interrupciones del proceso.
## Verificación de integración HTTP

Se ha comprobado con componentes reales:
- Inicio de sesión mediante correo y contraseña.
- Subida multipart con la cookie emitida.
- Rechazo de descarga sin sesión.
- Descarga autenticada de la versión optimizada.
- Coincidencia de los bytes descargados con el archivo almacenado.
- Conservación del original y registro de la actividad.

Esta prueba utiliza un cliente HTTP de Node.
Las políticas de cookies del navegador se verificarán al integrar
el frontend.


## Alcance del almacenamiento actual

El entorno actual utiliza almacenamiento local.
La integración con Amazon S3 todavía está pendiente.