import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../../shared/api/http';
import type { PlanoProyecto } from '../../types/plano';
import type { IncidenciaPlano } from '../../types/incidencia';
import { guardarMediciones, leerMediciones, rutaMediciones } from '../../api/mediciones.api';
import { cargarAutodesk, medicionesCompletas, normalizarMediciones, serializarEstado } from './autodesk';
import type { EstadoMediciones, Measure, RegistroMediciones, Viewer } from './autodesk';
import styles from './PlanViewer.module.css';

interface Props {
  plano: PlanoProyecto;
  pagina: number;
  incidencias: IncidenciaPlano[];
  crearIncidencia: boolean;
  onPaginas: (paginas: number) => void;
  onPunto: (x: number, y: number) => void;
  onSeleccionar: (incidencia: IncidenciaPlano) => void;
  onMedir: (activo: boolean) => void;
  onPendiente: (pendiente: boolean) => void;
  onActualizarIncidencias: () => void;
}

export function AutodeskCanvas(props: Props) {
  const { plano, pagina } = props;
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const acciones = useRef({ reintentar: () => {}, recargar: () => {}, exportar: () => {}, navegar: () => {}, medir: () => {}, proyectar: () => {} });
  const [intento, setIntento] = useState(0);
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState('Cargando visor y mediciones…');
  const [error, setError] = useState('');
  const [remoto, setRemoto] = useState(false);
  const [pines, setPines] = useState<{incidencia: IncidenciaPlano; x: number; y: number}[]>([]);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    const abort = new AbortController();
    const ruta = rutaMediciones(plano.id_proyecto, plano.id_plano, pagina);
    let activo = true;
    let viewer: Viewer | undefined;
    let measure: Measure | undefined;
    let blobUrl: string | undefined;
    let eventos: EventSource | undefined;
    let resize: ResizeObserver | undefined;
    let reloj: ReturnType<typeof setInterval> | undefined;
    let guardado: ReturnType<typeof setTimeout> | undefined;
    let respaldo: ReturnType<typeof setInterval> | undefined;
    let version = 0;
    let local: EstadoMediciones;
    let confirmado = '';
    let aplicando = false;
    let enviando = false;
    let fallo = false;
    let cargado = false;
    let leyendo = false;
    let remotoPendiente = false;
    const pendientes = () => cargado && serializarEstado(local) !== confirmado;
    const midiendo = () => viewer?.toolController.getTool('measure')?.isActive() === true;
    const notificarPendiente = () => latest.current.onPendiente(pendientes() || enviando);
    const mensaje = (e: unknown) => e instanceof Error ? e.message : 'No fue posible guardar las mediciones.';

    function proyectar() {
      if (!activo || !viewer?.model) return;
      const box = viewer.model.getBoundingBox();
      setPines(latest.current.incidencias.map(incidencia => {
        const punto = box.min.clone().set(
          box.min.x + incidencia.coordenada_x * (box.max.x - box.min.x),
          box.max.y - incidencia.coordenada_y * (box.max.y - box.min.y), box.min.z);
        return { incidencia, ...viewer!.worldToClient(punto) };
      }));
    }

    function capturar() {
      if (!activo || !cargado || aplicando || !measure || !midiendo()) return;
      const medidas = normalizarMediciones(medicionesCompletas(measure.getMeasurementList()));
      const siguiente: EstadoMediciones = { ...local, mediciones: medidas,
        unidades: measure.getUnits() || 'm', precision: measure.getPrecision() ?? 2 };
      const factor = measure.getCalibrationFactor();
      if (local.calibracion && factor > 0 && Number.isFinite(factor)) siguiente.calibracion = {factor, unidades: siguiente.unidades};
      if (serializarEstado(siguiente) === serializarEstado(local)) return;
      local = siguiente;
      notificarPendiente();
      if (fallo) return;
      setEstado('Cambios pendientes…');
      if (guardado) clearTimeout(guardado);
      guardado = setTimeout(() => { void guardar(); }, 650);
    }

    async function guardar() {
      if (!activo || enviando || fallo || !pendientes()) return;
      enviando = true; notificarPendiente(); setEstado('Guardando…');
      const enviado = serializarEstado(local);
      try {
        const respuesta = await guardarMediciones(ruta, version, JSON.parse(enviado) as EstadoMediciones);
        if (!activo) return;
        version = respuesta.version; confirmado = enviado;
        setError(''); setEstado('Guardado');
      } catch (e) {
        if (!activo) return;
        fallo = true; setError(mensaje(e));
        setEstado(e instanceof ApiError && e.status === 409 ? 'Conflicto de edición' : 'Sin guardar');
      } finally {
        enviando = false;
        if (activo) {
          notificarPendiente();
          if (!fallo && pendientes()) void guardar();
          else if (!fallo && remotoPendiente) void actualizar();
        }
      }
    }

    function aplicar(registro: RegistroMediciones) {
      if (!measure || !viewer || !activo) return;
      aplicando = true;
      const estabaMidiendo = midiendo();
      measure.deactivate();
      local = registro.estado; version = registro.version;
      measure.calibrateByScale(local.calibracion?.unidades ?? local.unidades, local.calibracion?.factor ?? 1);
      measure.setUnits(local.unidades); measure.setPrecision(local.precision);
      const medidas = local.mediciones.map(m => ({...m, picks: m.picks.map(p => ({...p, modelId: viewer!.model.id}))}));
      measure.restoreState({measurements: medidas});
      if (estabaMidiendo) measure.activate();
      confirmado = serializarEstado(local); cargado = true; fallo = false;
      aplicando = false; remotoPendiente = false;
      setRemoto(false); setError(''); setEstado('Guardado'); notificarPendiente();
    }

    async function actualizar(forzar = false) {
      if (!activo || !cargado || leyendo || enviando) { remotoPendiente = true; return; }
      capturar();
      const dibujando = midiendo() && measure!.getMeasurementList().some(m => m.picks.length > 0 && medicionesCompletas([m]).length === 0);
      if (!forzar && (pendientes() || dibujando || fallo)) { remotoPendiente = true; setRemoto(true); return; }
      leyendo = true;
      try {
        const respuesta = await leerMediciones(ruta, abort.signal);
        if (!activo) return;
        capturar();
        if (!forzar && (pendientes() || enviando || (midiendo() && measure!.getMeasurementList().some(m => m.picks.length > 0 && medicionesCompletas([m]).length === 0)))) { remotoPendiente = true; setRemoto(true); return; }
        if (forzar || respuesta.version > version) aplicar(respuesta);
        else { remotoPendiente = false; setRemoto(false); }
      } catch (e) {
        if (activo) { setError(mensaje(e)); setEstado('No se pudo sincronizar'); }
      } finally { leyendo = false; }
    }

    function exportar() {
      if (!cargado) return;
      capturar();
      const url = URL.createObjectURL(new Blob([JSON.stringify({id_plano: plano.id_plano, pagina, version, estado: local}, null, 2)], {type: 'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = `mediciones-${plano.id_plano}-p${pagina}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    acciones.current = {
      reintentar: () => { if (!cargado) setIntento(v => v + 1); else { fallo = false; setError(''); if (pendientes()) void guardar(); else void actualizar(true); } },
      recargar: () => {
        if (enviando) return;
        if (pendientes() && !window.confirm('Se descartarán tus cambios locales. Puedes cancelar y descargar el borrador antes de cargar la versión compartida. ¿Continuar?')) return;
        void actualizar(true);
      },
      exportar,
      navegar: () => { capturar(); measure?.deactivate(); },
      medir: () => { measure?.activate('distance'); },
      proyectar,
    };
    function antesDeSalir(event: BeforeUnloadEvent) {
      capturar();
      if (pendientes() || enviando) { event.preventDefault(); event.returnValue = ''; }
    }
    function punto(event: MouseEvent) {
      if (!cargado || !viewer || !latest.current.crearIncidencia || midiendo() || !(event.target instanceof HTMLCanvasElement)) return;
      const rect = container.getBoundingClientRect();
      const hit = viewer.clientToWorld(event.clientX - rect.left, event.clientY - rect.top, true);
      if (!hit) return;
      const box = viewer.model.getBoundingBox();
      const x = (hit.point.x - box.min.x) / (box.max.x - box.min.x);
      const y = (box.max.y - hit.point.y) / (box.max.y - box.min.y);
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) latest.current.onPunto(x, y);
    }
    container.addEventListener('click', punto);
    window.addEventListener('beforeunload', antesDeSalir);

    async function iniciar() {
      setListo(false); setError(''); setEstado('Cargando visor y mediciones…');
      try {
        const viewing = await cargarAutodesk();
        if (!activo) return;
        viewer = new viewing.GuiViewer3D(container, {extensions: []});
        if (viewer.start() !== 0) throw new Error('No fue posible iniciar WebGL para Autodesk Viewer.');
        viewer.setTheme('light-theme');
        viewer.prefs.set('restoreMeasurements', true);
        await viewer.loadExtension('Autodesk.PDF');
        if (!activo) return;
        const archivo = await fetch(plano.url, {credentials: 'same-origin', signal: abort.signal});
        if (!archivo.ok) throw new Error('No fue posible descargar el plano. Comprueba tu sesión.');
        const blob = await archivo.blob();
        if (!activo) return;
        blobUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => viewer!.loadModel(blobUrl + '#plano.pdf', {page: pagina}, () => resolve(), () => reject(new Error('Autodesk no pudo abrir esta página del PDF.'))));
        if (!activo) return;
        await viewer.waitForLoadDone({geometry: true});
        if (!activo) return;
        const hojas = viewer.model.getDocumentNode().getRootNode().search({type: 'geometry', role: '2d'}, true);
        latest.current.onPaginas(Math.max(pagina, hojas.length));
        measure = await viewer.loadExtension('Autodesk.Measure') as Measure;
        if (!activo) return;
        measure.setFreeMeasureMode(true);
        aplicar(await leerMediciones(ruta, abort.signal));
        if (!activo) return;
        viewer.addEventListener(viewing.CAMERA_CHANGE_EVENT, proyectar);
        const eventosMedicion = viewing.MeasureCommon.Events;
        for (const key of ['MEASUREMENT_COMPLETED_EVENT', 'DELETE_MEASUREMENT']) {
          if (eventosMedicion[key]) viewer.addEventListener(eventosMedicion[key], () => { queueMicrotask(capturar); });
        }
        if (eventosMedicion.FINISHED_CALIBRATION) viewer.addEventListener(eventosMedicion.FINISHED_CALIBRATION, event => {
          if (aplicando || !event.units || !event.scaleFactor) return;
          local = {...local, calibracion: {factor: event.scaleFactor, unidades: event.units}, unidades: event.units};
          notificarPendiente(); queueMicrotask(() => { capturar(); void guardar(); });
        });
        if (eventosMedicion.MEASUREMENT_MODE_ENTER) viewer.addEventListener(eventosMedicion.MEASUREMENT_MODE_ENTER, () => { latest.current.onMedir(true); });
        if (eventosMedicion.MEASUREMENT_MODE_LEAVE) viewer.addEventListener(eventosMedicion.MEASUREMENT_MODE_LEAVE, () => { latest.current.onMedir(false); });
        resize = new ResizeObserver(() => { viewer?.resize(); proyectar(); }); resize.observe(container);
        reloj = setInterval(capturar, 400);
        respaldo = setInterval(() => { void actualizar(); latest.current.onActualizarIncidencias(); }, 30000);
        eventos = new EventSource('/api/notificaciones/eventos');
        eventos.addEventListener('open', () => { void actualizar(); latest.current.onActualizarIncidencias(); });
        eventos.addEventListener('error', () => { if (activo) setEstado(pendientes() ? 'Cambios pendientes; reconectando…' : 'Reconectando sincronización…'); });
        eventos.addEventListener('proyecto', event => {
          try {
            const datos = JSON.parse((event as MessageEvent<string>).data) as {id_proyecto: string; recurso: string};
            if (datos.id_proyecto !== plano.id_proyecto) return;
            if (datos.recurso === 'MEDICIONES') void actualizar();
            if (datos.recurso === 'INCIDENCIAS') latest.current.onActualizarIncidencias();
          } catch { /* Ignorar mensajes que no corresponden al contrato. */ }
        });
        setListo(true); proyectar();
        if (local.mediciones.length > 0) measure.activate();
      } catch (e) { if (activo) { setError(mensaje(e)); setEstado('No disponible'); } }
    }
    void iniciar();
    return () => {
      activo = false; abort.abort(); eventos?.close(); resize?.disconnect();
      clearInterval(reloj); clearInterval(respaldo); clearTimeout(guardado);
      window.removeEventListener('beforeunload', antesDeSalir); container.removeEventListener('click', punto);
      viewer?.finish(); if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [plano.id_plano, plano.id_proyecto, plano.url, pagina, intento]);

  useEffect(() => { acciones.current.proyectar(); }, [props.incidencias]);
  useEffect(() => { if (props.crearIncidencia) acciones.current.navegar(); }, [props.crearIncidencia]);

  return <div className={styles.autodeskStage}>
    <div ref={host} className={styles.autodeskHost} />
    {listo && <div className={styles.autodeskPins}>{pines.map(({incidencia, x, y}) =>
      <button key={incidencia.id_incidencia} className={styles.incidentMarker} style={{left: x, top: y}}
        title={incidencia.titulo} aria-label={`Incidencia: ${incidencia.titulo}`}
        onClick={() => latest.current.onSeleccionar(incidencia)}>!</button>)}</div>}
    {(!listo || error || remoto) && <div className={styles.syncStatus} role="status">
      <span>{estado}</span>
      {error && <span role="alert">{error}</span>}
      {remoto && <span>Hay cambios compartidos disponibles.</span>}
      {error && <button type="button" onClick={() => acciones.current.reintentar()}>Reintentar</button>}
      {(error || remoto) && listo && <>
        <button type="button" onClick={() => acciones.current.exportar()}>Descargar borrador</button>
        <button type="button" onClick={() => acciones.current.recargar()}>Cargar versión compartida</button>
      </>}
    </div>}
    {!listo && <div className={styles.viewerBlocker} aria-label="Visor cargando" />}
  </div>;
}


