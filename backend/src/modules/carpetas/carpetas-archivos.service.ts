import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { ResultadoTransaccionDesconocidoError } from '../../database/errors/resultado-transaccion-desconocido.error';
import { AlmacenamientoService } from '../almacenamiento/almacenamiento.service';
import { CarpetasAccesoRepository } from './carpetas-acceso.repository';
import { CarpetasRepository } from './carpetas.repository';
import { validarArchivoCarpeta } from './validar-archivo-carpeta';
export interface ArchivoCarpeta { id_archivo: string; nombre: string; extension: string; mime_type: string; tamano: number; fecha_subida: Date; }
@Injectable()
export class CarpetasArchivosService {
 constructor(private readonly db: DatabaseService, private readonly acceso: CarpetasAccesoRepository,
 private readonly carpetas: CarpetasRepository, private readonly almacenamiento: AlmacenamientoService) {}
 private async autorizar(client: PoolClient, proyecto: string, carpeta: string, usuario: string) {
   if (!await this.acceso.bloquearDisponible(client,proyecto,usuario) || !await this.carpetas.bloquear(client,proyecto,carpeta))
     throw new NotFoundException('La carpeta no está disponible.');
 }
 async subir(proyecto: string, carpeta: string, usuario: string, archivo?: Express.Multer.File) {
   await this.db.withTransaction(c => this.autorizar(c,proyecto,carpeta,usuario));
   const datos=validarArchivoCarpeta(archivo);
   const clave='archivos/'+randomUUID()+'.'+datos.extension;
   const entrada=Readable.from([archivo!.buffer]);
   try { await this.almacenamiento.guardar(clave,entrada); } finally { entrada.destroy(); }
   try {
     return await this.db.withTransaction(async c => {
       await this.autorizar(c,proyecto,carpeta,usuario);
       const r=await c.query<ArchivoCarpeta>(
         'INSERT INTO obra.carpeta_archivos(id_proyecto,id_carpeta,id_usuario_subida,nombre,extension,mime_type,tamano,s3_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_archivo,nombre,extension,mime_type,tamano,fecha_subida',
         [proyecto,carpeta,usuario,datos.nombre,datos.extension,datos.mime_type,datos.tamano,clave]);
       return r.rows[0];
     });
   } catch (error) {
     if (!(error instanceof ResultadoTransaccionDesconocidoError)) await this.almacenamiento.eliminar(clave);
     throw error;
   }
 }
 async abrir(proyecto: string, carpeta: string, usuario: string, id: string) {
   const archivo=await this.db.withTransaction(async c => {
     await this.autorizar(c,proyecto,carpeta,usuario);
     const r=await c.query<ArchivoCarpeta & {s3_key:string}>('SELECT * FROM obra.carpeta_archivos WHERE id_proyecto=$1 AND id_carpeta=$2 AND id_archivo=$3',[proyecto,carpeta,id]);
     if(!r.rows[0]) throw new NotFoundException('El archivo no está disponible.');
     return r.rows[0];
   });
   return {archivo, flujo:await this.almacenamiento.abrirLectura(archivo.s3_key)};
 }
}
