import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/create-validation-pipe';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { Server } from 'node:http';

async function bootstrap(): Promise<void> {
  const host = process.env.HOST ?? '127.0.0.1';
  const portText = process.env.PORT ?? '3000';
  const port = Number(portText);

  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('PORT debe ser un número entero entre 1 y 65535.');
  }

  const app = await NestFactory.create(AppModule);

  // 1. Habilitar CORS para permitir peticiones directas desde Vercel y local
  app.enableCors({
    origin: [
      'https://ingevit.vercel.app',
      'http://localhost:4300',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  });

  // 2. Aumentar límites del parser para peticiones pesadas (hasta 3.5 GB para GeoTIFFs)
  app.use(json({ limit: '3500mb' }));
  app.use(urlencoded({ limit: '3500mb', extended: true }));

  // Interpreta las cookies antes de ejecutar los guards.
  app.use(cookieParser());

  // Aplica la configuración de validación a las entradas de las rutas.
  app.useGlobalPipes(createValidationPipe());

  // Permite ejecutar los métodos de apagado ante señales como Ctrl+C.
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  /*
   * Amplía timeouts de socket/petición HTTP.
   */
  const servidor = app.getHttpServer() as Server;
  servidor.requestTimeout = 60 * 60 * 1000; // 1 hora
  servidor.headersTimeout = 65 * 60 * 1000;

  await app.listen(port, host);

  console.log(`Backend disponible en http://${host}:${port}/api/health`);
}

bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exitCode = 1;
});