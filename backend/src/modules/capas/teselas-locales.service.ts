import { Injectable, NotFoundException } from '@nestjs/common';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { getAlmacenamientoLocalConfig } from '../almacenamiento/config/almacenamiento.config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BYTES = 1024 * 1024;
const FIRMA_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Lee una tesela pequeña, nunca el GeoTIFF original.
 * No crea directorios y rechaza enlaces simbólicos y rutas no canónicas.
 * La raíz y sus padres deben ser administrados exclusivamente por el servidor.
 */
@Injectable()
export class TeselasLocalesService {
  async leer(capa: string, version: string, z: number, x: number, y: number): Promise<Buffer> {
    if (!UUID.test(capa) || !UUID.test(version)
        || !Number.isInteger(z) || z < 0 || z > 30
        || !Number.isInteger(x) || !Number.isInteger(y)
        || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      throw new NotFoundException('La tesela no está disponible.');
    }
    try {
      let ruta = getAlmacenamientoLocalConfig().directorioRaiz;
      await this.comprobarDirectorio(ruta);
      for (const parte of ['capas-teselas', capa, version, 'tiles', String(z), String(x)]) {
        ruta = join(ruta, parte);
        await this.comprobarDirectorio(ruta);
      }
      ruta = join(ruta, `${y}.png`);
      const previo = await lstat(ruta);
      if (previo.isSymbolicLink() || !previo.isFile()
          || relative(ruta, await realpath(ruta)) !== '') {
        throw new NotFoundException('La tesela no está disponible.');
      }
      const archivo = await open(ruta, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const actual = await archivo.stat();
        if (!actual.isFile() || actual.ino !== previo.ino || actual.dev !== previo.dev
            || actual.size < 33 || actual.size > MAX_BYTES) {
          throw new NotFoundException('La tesela no está disponible.');
        }
        // Lectura acotada aunque otro proceso altere el archivo mientras se lee.
        const buffer = Buffer.alloc(actual.size);
        let leidos = 0;
        while (leidos < buffer.length) {
          const lectura = await archivo.read(buffer, leidos, buffer.length - leidos, leidos);
          if (lectura.bytesRead === 0) break;
          leidos += lectura.bytesRead;
        }
        if (leidos !== buffer.length || !buffer.subarray(0, 8).equals(FIRMA_PNG)
            || buffer.toString('ascii', 12, 16) !== 'IHDR'
            || buffer.readUInt32BE(16) !== 256 || buffer.readUInt32BE(20) !== 256) {
          throw new NotFoundException('La tesela no está disponible.');
        }
        return buffer;
      } finally {
        await archivo.close();
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error
          && ['ENOENT', 'ENOTDIR', 'ELOOP'].includes(String(error.code))) {
        throw new NotFoundException('La tesela no está disponible.');
      }
      throw error;
    }
  }

  private async comprobarDirectorio(ruta: string): Promise<void> {
    const info = await lstat(ruta);
    if (info.isSymbolicLink() || !info.isDirectory() || relative(ruta, await realpath(ruta)) !== '') {
      throw new NotFoundException('La tesela no está disponible.');
    }
  }
}
