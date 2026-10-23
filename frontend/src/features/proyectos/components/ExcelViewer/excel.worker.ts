import { readExcel } from './excel-reader';
self.onmessage=async(event:MessageEvent<{data:ArrayBuffer;extension:string}>)=>{
 try { self.postMessage({book:await readExcel(event.data.data,event.data.extension)}); }
 catch { self.postMessage({error:'No se pudo abrir este Excel. Puede estar dañado, protegido con contraseña o usar un formato no compatible.'}); }
};
