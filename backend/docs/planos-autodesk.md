# Mediciones de planos con Autodesk

El visor de planos utiliza APS Viewer 7.113.0 y Autodesk.PDF, en modo Local. Los PDF se descargan desde la URL autenticada existente y se abren mediante una URL blob. No se envían a Model Derivative. No se requieren claves APS para este flujo de PDF local; sí acceso al CDN de Autodesk y WebGL en el navegador.

## Puesta en marcha

1. Aplicar `sql/2026-10-19_planos_mediciones.sql` en la base de datos del entorno. Ya se aplicó en la base local configurada en este equipo durante la implementación.
2. Compilar y reiniciar el backend: `npm run build` y el comando de arranque habitual.
3. Compilar/publicar o reiniciar el frontend como de costumbre.
4. Mantener operativo `/api/notificaciones/eventos` y el listener PostgreSQL de `proyecto_cambios`. Los proxies deben permitir SSE sin buffering.

## Uso

Abrir un plano, pulsar «Ver / crear medidas» o la regla de Autodesk. Usar calibración con una distancia real conocida antes de medir. Distancia, ángulo, área, unidades y precisión se guardan por página. Las medidas guardadas se restauran al reabrir la página. «Navegar» sale de medición y «Nueva incidencia» conserva el flujo anterior.

El indicador distingue cambios pendientes, guardando, guardado y errores. Una edición concurrente devuelve 409. Se puede descargar el borrador JSON y cargar la versión compartida. No hay fusión automática de ediciones simultáneas de una misma página: prevalece el primer guardado confirmado. La descarga del borrador es un respaldo, no existe aún una interfaz para importarlo.

Los cambios usan PostgreSQL NOTIFY después de COMMIT y el canal SSE existente. Al reconectar se consulta la versión actual; hay una comprobación adicional cada 30 segundos. Si se está dibujando o hay cambios locales, la versión remota se difiere para no borrarlos.

## Contrato

GET/PUT `/api/proyectos/:idProyecto/planos/:idPlano/paginas/:pagina/mediciones`.
PUT recibe `{version, estado}`; estado incluye schema=1, mediciones, calibracion, unidades y precision. El autor procede de la sesión. Se verifica acceso al proyecto y la existencia de la página. La versión inicial es cero. Cada PUT incrementa la versión. Límite: 500 medidas y 512 KB por página. Al eliminar el plano, las medidas se eliminan mediante FK en cascada.

No se han añadido anotaciones de texto persistentes ni integración con modelos DWG/Revit o Autodesk Construction Cloud.

## Validación realizada

- Compilación TypeScript del backend y compilación de producción del frontend.
- ESLint de los archivos del visor y su API.
- 7 pruebas del backend: `node --test test/planos-mediciones.test.cjs` después de compilar.
- 3 pruebas del adaptador frontend: `node --experimental-strip-types --test test/autodesk.test.cjs` (Node 24).
- Guardado, lectura y rechazo de versión antigua contra PostgreSQL local, dentro de una transacción revertida sin conservar medidas de prueba.
- Pendiente: prueba visual interactiva y prueba con dos navegadores reales. El navegador automatizado no pudo iniciarse/acceder al servidor de prueba en este entorno.
- El lint global presenta errores en otros módulos. La suite general del backend también presenta fallos ajenos al módulo nuevo, incluidos permisos de creación de enlaces de Windows y contratos existentes de incidencias de mapa.

## Referencias

- https://aps.autodesk.com/blog/dwf-local-support-aps-viewer
- https://aps.autodesk.com/blog/fast-pdf-viewingmarkup-inside-aps-viewer
- SDK fijado: https://developer.api.autodesk.com/modelderivative/v2/viewers/7.113.0/extensions/Measure/Measure.js
