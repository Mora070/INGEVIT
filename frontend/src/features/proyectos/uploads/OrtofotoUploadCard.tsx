import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { descartarSubida, interrumpirSubida, mostrarDetallesSubida,
  observarSubida, obtenerSubida, subidaActiva } from './subidaOrtofoto';
import styles from './OrtofotoUploadCard.module.css';

function tamano(bytes: number) {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
const titulos = {
  subiendo: 'Subiendo ortofoto', confirmando: 'Guardando archivo',
  pendiente: 'En cola de procesamiento', procesando: 'Procesando ortofoto',
  lista: 'Ortofoto lista', cancelada: 'Subida cancelada', error: 'Revisar ortofoto',
};

export function OrtofotoUploadCard() {
  const subida = useSyncExternalStore(observarSubida, obtenerSubida);
  const [cancelarPara, setCancelarPara] = useState<number | null>(null);
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const seguirRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const activa = subida?.estado === 'subiendo' || subida?.estado === 'confirmando';
  const pregunta = !!subida && cancelarPara === subida.id && subida.estado === 'subiendo';
  useEffect(() => {
    if (!activa) return;
    const advertir = (evento: BeforeUnloadEvent) => {
      if (subidaActiva()) { evento.preventDefault(); evento.returnValue = ''; }
    };
    window.addEventListener('beforeunload', advertir);
    return () => window.removeEventListener('beforeunload', advertir);
  }, [activa]);
  useEffect(() => {
    if (!subida?.detalles || pregunta) return;
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') mostrarDetallesSubida(false);
    };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [subida?.detalles, pregunta]);
  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!pregunta || !dialogo) return;
    const botonCancelar = cancelarRef.current;
    dialogo.showModal();
    seguirRef.current?.focus();
    return () => {
      dialogo.close();
      if (botonCancelar?.isConnected) botonCancelar.focus();
    };
  }, [pregunta]);
  if (!subida) return null;
  const porcentaje = subida.total && subida.total > 0
    ? Math.min(100, Math.floor(subida.enviados / subida.total * 100)) : null;
  const texto = subida.estado === 'subiendo'
    ? 'Puedes navegar por INGEVIT. No cierres esta pestaña hasta terminar el envío.'
    : subida.estado === 'confirmando'
    ? 'Archivo enviado. El servidor está confirmando su recepción. Todavía no se ha confirmado el procesamiento de esta subida.'
    : subida.estado === 'pendiente'
    ? 'El servidor recibió el archivo y está esperando para procesarlo. Puedes cerrar esta pestaña.'
    : subida.estado === 'procesando'
    ? 'Generando las imágenes del mapa. El procesamiento continúa en el servidor.'
    : subida.estado === 'lista'
    ? 'Ya puedes visualizar la ortofoto en las capas del proyecto.'
    : subida.estado === 'cancelada' ? 'Se interrumpió el envío del archivo.' : subida.mensaje;
  return <>
    <aside className={styles.card} aria-label="Estado de subida de ortofoto">
      <div className={styles.heading}>
        <span className={styles.indicator} data-state={subida.estado} aria-hidden="true" />
        <strong role="status">{titulos[subida.estado]}</strong>
        {subida.estado === 'subiendo' && <span className={styles.percent}>{porcentaje === null ? '…' : `${porcentaje} %`}</span>}
        {!activa && <button type="button" className={styles.iconButton} onClick={descartarSubida} aria-label="Cerrar aviso">×</button>}
      </div>
      <p className={styles.name} title={subida.nombre}>{subida.nombre}</p>
      {subida.estado === 'subiendo' && <progress className={styles.progress} max={100} value={porcentaje ?? undefined} aria-label="Progreso de envío" />}
      <div className={styles.actions}>
        <button type="button" onClick={() => mostrarDetallesSubida(!subida.detalles)} aria-expanded={subida.detalles}>
          {subida.detalles ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
        {subida.estado === 'subiendo' && <button ref={cancelarRef} type="button" className={styles.cancel} onClick={() => setCancelarPara(subida.id)}>Cancelar subida</button>}
        {subida.estado === 'confirmando' && <span className={styles.hint}>Esperando al servidor</span>}
      </div>
      {subida.estado === 'subiendo' && !subida.detalles && <p className={styles.hint}>Mantén esta pestaña abierta.</p>}
      {(subida.detalles || subida.estado === 'error') && <div className={styles.details}>
        <p className={styles.description} role={subida.estado === 'error' ? 'alert' : undefined}>{texto}</p>
        {subida.detalles && <dl>
          <dt>Archivo</dt><dd>{subida.archivo}</dd>
          <dt>Tamaño</dt><dd>{tamano(subida.tamano)}</dd>
          {subida.estado === 'subiendo' && <><dt>Enviados</dt><dd>{tamano(subida.enviados)}</dd></>}
        </dl>}
      </div>}
      {subida.avisoEstado && <p className={styles.description} role="status">{subida.avisoEstado}</p>}
    </aside>
    {pregunta && <dialog ref={dialogoRef} className={styles.confirmDialog} aria-labelledby="cancelar-ortofoto-titulo" aria-describedby="cancelar-ortofoto-texto" onCancel={evento => {
      evento.preventDefault(); setCancelarPara(null);
    }}>
      <h2 id="cancelar-ortofoto-titulo">¿Cancelar la subida?</h2>
      <p id="cancelar-ortofoto-texto">Se detendrá el envío de la ortofoto. Si quieres subirla después, tendrás que empezar de nuevo.</p>
      <div className={styles.confirmActions}>
        <button ref={seguirRef} type="button" onClick={() => setCancelarPara(null)}>Seguir subiendo</button>
        <button type="button" className={styles.confirmCancel} onClick={() => {
          setCancelarPara(null); interrumpirSubida();
        }}>Sí, cancelar</button>
      </div>
    </dialog>}
  </>;
}
