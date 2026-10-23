import { useRef, useState } from 'react';
import { subirArchivoCarpeta } from '../../api/archivos-carpeta.api';
import styles from './AddFolderResourcesModal.module.css';
interface Props { idProyecto:string; idCarpeta:string; ocupado:boolean; onOcupado:(valor:boolean)=>void; onCompletado:()=>void; }
export function FolderFileUpload({idProyecto,idCarpeta,ocupado,onOcupado,onCompletado}:Props) {
 const [archivos,setArchivos]=useState<File[]>([]);
 const [mensaje,setMensaje]=useState('');
 const [error,setError]=useState('');
 const enCurso=useRef(false);
 const input=useRef<HTMLInputElement>(null);
 function seleccionar(lista:FileList|null) {
   if(!lista) return;
   const nuevos=Array.from(lista);
   if(nuevos.some(f=> !/\.(pdf|xlsx?|dwg)$/i.test(f.name) || f.size===0 || f.size>50*1024*1024)) {
     setError('Selecciona PDF, XLS, XLSX o DWG, no vacíos y de hasta 50 MB por archivo.');
     if(input.current) input.current.value='';
     return;
   }
   setArchivos(nuevos);setError('');setMensaje('');
 }
 async function subir() {
   if(enCurso.current || ocupado || !archivos.length) return;
   enCurso.current=true;onOcupado(true);setError('');
   let completados=0;
   try {
     for(let i=0;i<archivos.length;i++) {
       setMensaje('Subiendo '+(i+1)+' de '+archivos.length+': '+archivos[i].name);
       await subirArchivoCarpeta(idProyecto,idCarpeta,archivos[i]);
       completados++;
       setArchivos(archivos.slice(completados));
     }
     if(input.current) input.current.value='';
     setMensaje('Archivos cargados.');onCompletado();
   } catch(e) {
     setMensaje(completados ? completados+' archivo(s) guardado(s). Los restantes siguen seleccionados.' : '');
     setError(e instanceof Error ? e.message : 'No fue posible cargar los archivos.');
   } finally { enCurso.current=false;onOcupado(false); }
 }
 return <section className={styles.uploadSection} aria-label="Cargar archivos a la carpeta">
   <div className={styles.uploadIntro}>
     <span className={styles.uploadIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg></span>
     <div className={styles.uploadCopy}><strong>Sube archivos desde tu equipo</strong><p>PDF, Excel y DWG · Máximo 50 MB por archivo</p></div>
     <button type="button" className={styles.chooseFiles} disabled={ocupado} onClick={()=>input.current?.click()}>
       <span aria-hidden="true">+</span> {archivos.length ? 'Cambiar archivos' : 'Elegir archivos'}
     </button>
   </div>
   <input ref={input} type="file" multiple accept=".pdf,.xls,.xlsx,.dwg" hidden disabled={ocupado} onChange={e=>seleccionar(e.target.files)} aria-label="Seleccionar archivos para cargar" />
   {archivos.length>0 && <>
     <ul className={styles.uploadFiles}>{archivos.map((f,i)=><li key={i}>
       <span className={styles.uploadFileType}>{f.name.split('.').pop()?.toUpperCase()}</span>
       <span className={styles.uploadFileName} title={f.name}>{f.name}</span>
       <span className={styles.uploadFileSize}>{(f.size/1024/1024).toFixed(1)} MB</span>
     </li>)}</ul>
     <div className={styles.uploadActions}><span>{archivos.length} {archivos.length===1 ? 'archivo seleccionado' : 'archivos seleccionados'}</span>
       <button type="button" className={styles.addButton} disabled={ocupado} onClick={()=>void subir()}>{ocupado ? 'Cargando…' : 'Cargar en esta carpeta'}</button>
     </div>
   </>}
   {mensaje && <p className={styles.uploadStatus} role="status">{mensaje}</p>}
   {error && <p className={styles.error} role="alert">{error}</p>}
 </section>;
}
