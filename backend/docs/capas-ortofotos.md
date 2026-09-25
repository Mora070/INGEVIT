# Capas de ortofotos: contrato y operación local

## Alcance

El backend conserva el GeoTIFF original y genera teselas PNG XYZ
mediante Python, Rasterio y GDAL.

Las teselas se sirven desde el backend con autenticación.
Este flujo no publica la ortofoto en Mapbox Tilesets:
el visor del frontend consume una fuente raster externa.

El almacenamiento implementado en este bloque es local.

## Acceso

- El propietario puede subir, configurar, reintentar y eliminar capas.
- El propietario y los colaboradores autorizados pueden consultarlas.
- Opacidad, visibilidad y orden son compartidos por todo el proyecto.
- TileJSON y PNG requieren la sesión, igual que las demás consultas.
- Las operaciones de escritura requieren un Origin permitido.

No exponer la carpeta física de teselas como un directorio público
que omita las comprobaciones de acceso del backend.

## RutasSS

Prefijo: /api/proyectos/{idProyecto}/capas

| Método | Ruta adicional | Operación |
|---|---|---|
| GET | — | Consultar capas paginadas |
| POST | — | Subir GeoTIFF |
| PATCH | /{idCapa}/configuracion | Cambiar presentación |
| POST | /{idCapa}/reintentar | Solicitar un nuevo intento |
| DELETE | /{idCapa} | Eliminar la capa |
| GET | /{idCapa}/teselas/{version}/tilejson.json | Obtener descriptor |
| GET | /{idCapa}/teselas/{version}/{z}/{x}/{y}.png | Obtener tesela |

La consulta admite pagina y limite.

## Subida

Enviar multipart/form-data con:

- archivo: GeoTIFF.
- nombre: nombre de la capa.
- descripcion: descripción de la capa.

El cliente debe permitir que su biblioteca HTTP construya
Content-Type y el boundary del formulario.

La respuesta de subida no significa que el procesamiento haya terminado.
Consultar posteriormente el listado para conocer el estado.

## Estados

- PENDIENTE: espera procesamiento.
- PROCESANDO: tiene un intento en curso.
- LISTA: tiene una colección publicada.
- ERROR: el intento no pudo completarse.

El frontend solo debe dibujar una capa cuando esté LISTA,
visible sea true y teselas contenga los metadatos publicados.

El reintento devuelve HTTP 202. No requiere volver a subir el original.
Una capa que no cumple las condiciones para reintentar devuelve conflicto.

## Configuración compartida

PATCH /{idCapa}/configuracion

Enviar los tres campos como JSON:

```json
{
  "opacidad": 0.8,
  "visible": true,
  "orden": 2
}
```

- opacidad: número entre 0 y 1.
- visible: booleano.
- orden: entero entre 0 y 2147483647.
- Los órdenes mayores deben dibujarse encima de los menores.
- El frontend debe definir un desempate estable para órdenes iguales.

## Visualización

Utilizar teselas.version de la respuesta de la capa para obtener
el TileJSON correspondiente.

El descriptor proporciona:

- scheme: xyz.
- tiles: plantilla de URL de los PNG.
- minzoom y maxzoom.
- bounds: oeste, sur, este, norte en grados WGS84.

El tamaño de tesela es 256 píxeles.

El frontend debe enviar la sesión tanto al solicitar TileJSON
como al solicitar cada PNG. La configuración de credenciales y CORS
debe comprobarse con los dominios reales del frontend y backend.

No usar las coordenadas X/Y de incidencias de plano como
coordenadas geográficas.

## Representación de datos

tamano_original_bytes y teselas.total son cadenas decimales.

No convertir indiscriminadamente valores bigint a Number
si pueden superar su rango de precisión.

La respuesta pública no incluye rutas físicas, claves del original
ni detalles técnicos internos del procesamiento.

## Configuración operativa

| Variable | Responsabilidad |
|---|---|
| CAPAS_MAX_ARCHIVO_BYTES | Tamaño máximo de cada subida |
| CAPAS_TEMP_ROOT | Directorio de trabajo separado del almacenamiento |
| CAPAS_TESELAS_MOTOR | Motor seleccionado; python para este flujo |
| CAPAS_PYTHON_PATH | Ejecutable del entorno Python |
| CAPAS_RASTERIO_SCRIPT | Procesador GeoTIFF |
| CAPAS_TESELAS_ZOOM_MIN | Primer zoom generado |
| CAPAS_TESELAS_ZOOM_MAX | Último zoom generado |
| CAPAS_TESELAS_MAX_ARCHIVOS | Presupuesto de cantidad de teselas |
| CAPAS_TESELAS_MAX_BYTES | Presupuesto de PNG generados por Python |
| CAPAS_TESELAS_TIMEOUT_MS | Tiempo máximo del proceso |
| CAPAS_RASTERIO_CACHE_MB | Presupuesto de caché GDAL |
| CAPAS_RASTERIO_WARP_MB | Presupuesto de reproyección |
| CAPAS_TRABAJADOR_HABILITADO | Activa el trabajador |
| CAPAS_TRABAJADOR_INTERVALO_MS | Intervalo entre ciclos |
| CAPAS_API_PUBLICA_URL | URL externa de la API, incluido /api |

El zoom máximo acordado para el entorno es 22.
No reducirlo silenciosamente para hacer que un trabajo quepa.

El motor Python admite hasta zoom 24. La configuración compartida
también conserva parámetros utilizados por el motor GDAL;
no retirarlos sin revisar su validación.

Los presupuestos de caché y reproyección no constituyen un límite
estricto de toda la memoria del proceso.

## Formatos y límites actuales

El procesador acepta ortofotos GeoTIFF con georreferenciación afín,
bandas RGB o grises Byte/uint8 y extensión compatible con Web Mercator.

No aplica automáticamente un escalado radiométrico a UInt16 o Float.
No realiza ortorrectificación de entradas basadas en GCP o RPC.

El presupuesto de bytes de teselas no reserva espacio libre:
el servidor necesita espacio para el original persistente, la copia
temporal, las teselas provisionales y su publicación.

La comprobación de bytes ocurre después de escribir cada PNG,
por lo que el provisional puede superar el presupuesto en una tesela.

## Fallos y recuperación

Una interrupción puede dejar temporales en disco.

La vigencia del intento es de cinco minutos desde su última renovación.
El trabajador recupera intentos vencidos y permite solicitar un reintento.

El original se conserva ante un fallo de procesamiento.
No debe compensarse una publicación basándose en una transacción
cuyo resultado sea incierto.

Eliminar una capa revoca su acceso y registra la limpieza pendiente.
La eliminación física puede completarse después mediante el trabajador.

## Auditoría

Ejecutar con el backend y los procesos GIS detenidos:

```powershell
node --env-file=.env scripts/auditar-almacenamiento.cjs
```

El auditor revisa referencias, colecciones publicadas y temporales.
No elimina archivos.

Los nuevos temporales contienen temporal.json con identificadores
del temporal y de la ejecución, tipo, fechas, equipo y PID.

Un registro válido, un PID ausente o una fecha antigua no bastan
por sí solos para autorizar una eliminación.

## Pendientes fuera del cierre funcional local

- Limpieza automática segura de temporales interrumpidos.
- Supervisión de espacio libre y capacidad del servidor.
- Configuración de almacenamiento, respaldos y despliegue de producción.
- Verificación conjunta de autenticación y visualización en el frontend.

Hasta automatizar la limpieza, utilizar la auditoría y el procedimiento
manual de eliminación de directorios concretos con todos los procesos
de escritura detenidos.