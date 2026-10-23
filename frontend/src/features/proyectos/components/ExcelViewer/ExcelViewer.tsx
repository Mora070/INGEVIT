import { useEffect, useRef, useState } from 'react';
import type { ArchivoCarpeta } from '../../types/carpeta';
import type { ExcelBook } from './excel-reader';
import styles from './ExcelViewer.module.css';
interface Props { archivo:ArchivoCarpeta; url:string; onCerrar:()=>void; }
function columnName(index:number):string { let n=index+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s; }
export default function ExcelViewer({archivo,url,onCerrar}:Props){
 const [book,setBook]=useState<ExcelBook>();const [images,setImages]=useState<string[][]>([]);const [error,setError]=useState('');
 const [active,setActive]=useState(0);const [zoom,setZoom]=useState(100);
 const dialog=useRef<HTMLElement>(null);const close=useRef<HTMLButtonElement>(null);const viewport=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   const abort=new AbortController();let alive=true;const urls:string[]=[];
   const worker=new Worker(new URL('./excel.worker.ts',import.meta.url),{type:'module'});
   const timer=setTimeout(()=>{abort.abort();worker.terminate();if(alive)setError('El archivo tarda demasiado en procesarse. Puedes descargarlo y abrirlo en Excel.');},45000);
   worker.onmessage=(event:MessageEvent<{book?:ExcelBook;error?:string}>)=>{clearTimeout(timer);worker.terminate();if(!alive)return;
     if(event.data.error){setError(event.data.error);return;}
     const result=event.data.book!;setImages(result.sheets.map(s=>s.images.map(i=>{const imageUrl=URL.createObjectURL(i.blob);urls.push(imageUrl);return imageUrl;})));setBook(result);
   };
   worker.onerror=()=>{clearTimeout(timer);worker.terminate();if(alive)setError('No se pudo cargar el visor de Excel. Recarga la página o descarga el archivo.');};
   void(async()=>{try{
     const response=await fetch(url,{credentials:'same-origin',signal:abort.signal});
     if(!response.ok)throw new Error(response.status===401?'Tu sesión ha expirado. Inicia sesión nuevamente.':'No se pudo descargar el archivo. Comprueba tus permisos.');
     const data=await response.arrayBuffer();if(!alive)return;if(data.byteLength>50*1024*1024)throw new Error('El archivo supera el límite de 50 MB del visor.');
     worker.postMessage({data,extension:archivo.extension},[data]);
   }catch(e){if(alive&&!abort.signal.aborted){clearTimeout(timer);worker.terminate();setError(e instanceof Error?e.message:'No se pudo abrir el archivo.');}}})();
   return()=>{alive=false;abort.abort();clearTimeout(timer);worker.terminate();urls.forEach(u=>URL.revokeObjectURL(u));};
 },[url,archivo.extension]);
 useEffect(()=>{
   const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';close.current?.focus();
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCerrar();}
     if(e.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select')??[]).filter(el=>el.offsetParent!==null);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
   document.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key,true);previous?.focus();};
 },[onCerrar]);
 const sheet=book?.sheets[active];
 return <div className={styles.overlay}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="excel-title" className={styles.viewer}>
   <header className={styles.header}><span className={styles.excelIcon} aria-hidden="true">X</span><div className={styles.title}><h2 id="excel-title" title={archivo.nombre}>{archivo.nombre}</h2><span>Excel · Solo lectura</span></div>
   <div className={styles.tools}><button disabled={!book||zoom<=50} aria-label="Reducir zoom" onClick={()=>setZoom(z=>z-10)}>−</button><button disabled={!book} title="Restablecer zoom" onClick={()=>setZoom(100)}>{zoom}%</button><button disabled={!book||zoom>=200} aria-label="Ampliar zoom" onClick={()=>setZoom(z=>z+10)}>+</button><a href={url} download>Descargar</a><button ref={close} onClick={onCerrar} aria-label="Cerrar visor">✕</button></div></header>
   {book && <div className={styles.notice}>Vista previa · Fórmulas con sus resultados guardados. Los gráficos, macros y algunos formatos avanzados no se representan.{book.warnings.map(w=><span key={w}> {w}</span>)}{sheet?.limited&&<strong> Hoja recortada por tamaño; descarga el original para ver todo el contenido.</strong>}</div>}
   <div ref={viewport} className={styles.viewport}>
     {error?<div className={styles.state} role="alert"><strong>No pudimos abrir el Excel</strong><p>{error}</p><a href={url} download>Descargar original</a></div>:!sheet?<div className={styles.state} role="status"><span className={styles.spinner}/><strong>Preparando las hojas…</strong></div>:
       <div className={styles.sheet} style={{zoom:zoom/100}}>
         <table aria-label={sheet.name} className={styles.table} style={{width:46+sheet.widths.reduce((a,b)=>a+b,0)}}><colgroup><col style={{width:46}}/>{sheet.widths.map((w,c)=><col key={c} style={{width:w,visibility:w===0?'collapse':undefined}}/>)}</colgroup>
         <thead><tr><th aria-label="Fila"/>{sheet.widths.map((w,c)=><th key={c} style={{display:w===0?'none':undefined}} scope="col">{columnName(c)}</th>)}</tr></thead>
         <tbody>{sheet.cells.map((row,r)=><tr key={r} style={{height:sheet.heights[r],display:sheet.heights[r]===0?'none':undefined}}><th scope="row">{r+1}</th>{row.map((cell,c)=>cell.covered?null:<td key={c} rowSpan={cell.rowSpan} colSpan={cell.colSpan} style={{...cell.style,display:sheet.widths[c]===0?'none':undefined}}><div style={{height:Math.max(16,sheet.heights.slice(r,r+(cell.rowSpan??1)).reduce((a,b)=>a+b,0)-7)}}>{cell.text}</div></td>)}</tr>)}</tbody></table>
         <div className={styles.images} aria-hidden="true">{sheet.images.map((i,n)=><img key={n} src={images[active]?.[n]} alt="" style={{left:i.x,top:i.y,width:i.width,height:i.height}}/>)}</div>
       </div>}
   </div>
   <footer className={styles.footer}><nav aria-label="Hojas del libro">{book?.sheets.map((s,i)=><button key={s.name} aria-pressed={active===i} className={active===i?styles.active:undefined} onClick={()=>{setActive(i);viewport.current?.scrollTo(0,0);}}>{s.name}</button>)}</nav><span>{book?book.sheets.length+' hojas':'Solo lectura'}</span></footer>
 </section></div>;
}
