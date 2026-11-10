import { useEffect, useSyncExternalStore } from 'react';
import { descartarSubida, interrumpirSubida, mostrarDetallesSubida,
  observarSubida, obtenerSubida, subidaActiva } from './subidaOrtofoto';
import styles from './OrtofotoUploadCard.module.css';

function tamano(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function OrtofotoUploadCard() {
  const subida = useSyncExternalStore(observarSubida, obtenerSubida);
  const activa = subida?.estado === 'subiendo' || subida?.estado === 'confirmando';
  useEffect(() => {
    if (!activa) return;
    const advertir = (evento: BeforeUnloadEvent) => {
      if (subidaActiva()) { evento.preventDefault(); evento.returnValue = ''; }
    };
    window.addEventListener('beforeunload', advertir);
    return () => window.removeEventListener('beforeunload', advertir);
  }, [activa]);
  useEffect(() => {
    if (!subida?.detalles) return;
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') mostrarDetallesSubida(false);
    };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [subida?.detalles]);
  if (!subida) return null;
  const porcentaje = subida.total && subida.total > 0
    ? Math.min(100, Math.floor(subida.enviados / subida.total * 100)) : null;
  const titulo = subida.estado === 'subiendo' ? 'Subiendo ortofoto'
    : subida.estado === 'confirmando' ? 'Confirmando recepción'
    : subida.estado === 'recibida' ? 'Archivo recibido' : 'La subida necesita atención';
  const texto = subida.estado === 'subiendo'
    ? 'Puedes seguir usando INGEVIT. Mantén esta pestaña abierta.'
    : subida.estado === 'confirmando'
    ? 'Archivo enviado. Esperando que el servidor confirme la recepción.'
    : subida.estado === 'recibida'
    ? 'El servidor continuará con el procesamiento. Consulta el estado en las capas del proyecto.'
    : subida.mensaje;
  return (
    <aside className={styles.card} aria-label="Estado de subida de ortofoto">
      <div className={styles.heading}>
        <strong role="status">{titulo}</strong>
        {subida.detalles
          ? <button type="button" onClick={() => mostrarDetallesSubida(false)} aria-label="Minimizar detalles">−</button>
          : !activa && <button type="button" onClick={descartarSubida} aria-label="Cerrar aviso">×</button>}
      </div>
      <p className={styles.name} title={subida.nombre}>{subida.nombre}</p>
      {subida.estado === 'subiendo' && <>
        <progress className={styles.progress} max={100} value={porcentaje ?? undefined} aria-label="Progreso de envío" />
        <p className={styles.meta}>{porcentaje === null ? 'Iniciando transferencia…' : `${porcentaje} % · ${tamano(subida.enviados)} enviados`}</p>
      </>}
      <p className={styles.description} role={subida.estado === 'error' ? 'alert' : undefined}>{texto}</p>
      {subida.detalles && <dl className={styles.details}>
        <dt>Archivo</dt><dd>{subida.archivo}</dd>
        <dt>Tamaño</dt><dd>{tamano(subida.tamano)}</dd>
        <dt>Después de la carga</dt><dd>La ortofoto se preparará para visualizarla en el mapa.</dd>
      </dl>}
      <div className={styles.actions}>
        {!subida.detalles && <button type="button" onClick={() => mostrarDetallesSubida(true)}>Ver detalles</button>}
        {subida.estado === 'subiendo' && <button type="button" className={styles.cancel} onClick={() => {
          if (window.confirm('¿Interrumpir la transferencia? Revisa las capas antes de volver a subir el archivo; el servidor podría haberlo recibido.')) interrumpirSubida();
        }}>Cancelar subida</button>}
      </div>
    </aside>
  );
}
