import { Controller, Post, Get, Param, ParseUUIDPipe, Req, Res, UseGuards, UseInterceptors, UploadedFile, UnauthorizedException, Header, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthRequest } from '../auth/types/auth-request.types';
import { CarpetasArchivosService } from './carpetas-archivos.service';
import { MAX_ARCHIVO_CARPETA } from './validar-archivo-carpeta';
@Controller('proyectos/:idProyecto/carpetas/:idCarpeta/archivos')
@UseGuards(AuthGuard)
export class CarpetasArchivosController {
 private readonly logger=new Logger(CarpetasArchivosController.name);
 constructor(private readonly archivos: CarpetasArchivosService) {}
 @Post()
 @Header('Cache-Control','no-store')
 @UseInterceptors(FileInterceptor('archivo',{limits:{files:1,fields:0,fileSize:MAX_ARCHIVO_CARPETA+1}}))
 subir(@Param('idProyecto',new ParseUUIDPipe()) proyecto:string, @Param('idCarpeta',new ParseUUIDPipe()) carpeta:string,
 @Req() req:AuthRequest, @UploadedFile() archivo:Express.Multer.File) {
   if(!req.usuario) throw new UnauthorizedException();
   return this.archivos.subir(proyecto,carpeta,req.usuario.id_usuario,archivo);
 }
 @Get(':idArchivo')
 async descargar(@Param('idProyecto',new ParseUUIDPipe()) proyecto:string, @Param('idCarpeta',new ParseUUIDPipe()) carpeta:string,
 @Param('idArchivo',new ParseUUIDPipe()) id:string, @Req() req:AuthRequest, @Res() res:Response) {
   if(!req.usuario) throw new UnauthorizedException();
   const {archivo,flujo}=await this.archivos.abrir(proyecto,carpeta,req.usuario.id_usuario,id);
   try {
     if(res.destroyed) return;
     res.setHeader('Content-Type',archivo.mime_type);
     res.setHeader('Content-Length',archivo.tamano);
     res.setHeader('Content-Disposition',"attachment; filename=archivo."+archivo.extension+"; filename*=UTF-8''"+encodeURIComponent(archivo.nombre));
     res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
     try { await pipeline(flujo,res); } catch { this.logger.warn('Transferencia de archivo interrumpida.'); }
   } finally { flujo.destroy(); }
 }
}
