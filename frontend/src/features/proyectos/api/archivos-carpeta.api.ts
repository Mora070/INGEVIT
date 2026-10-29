import { http } from '../../../shared/api/http';
import type { ArchivoCarpeta } from '../types/carpeta';
export function urlArchivoCarpeta(proyecto:string,carpeta:string,id?:string) {
 return '/api/proyectos/'+encodeURIComponent(proyecto)+'/carpetas/'+encodeURIComponent(carpeta)+'/archivos'+(id ? '/'+encodeURIComponent(id) : '');
}
export function subirArchivoCarpeta(proyecto:string,carpeta:string,archivo:File) {
 const body=new FormData();body.append('archivo',archivo);
 return http<ArchivoCarpeta>(urlArchivoCarpeta(proyecto,carpeta),{method:'POST',body});
}

export function quitarArchivoCarpeta(proyecto: string, carpeta: string, id: string) {
  return http<void>(urlArchivoCarpeta(proyecto, carpeta, id), {method: 'DELETE'});
}
export function moverArchivoCarpeta(proyecto: string, carpeta: string, id: string, destino: string) {
  return http<void>(urlArchivoCarpeta(proyecto, carpeta, id) + '/mover/' + encodeURIComponent(destino), {method: 'PATCH'});
}
