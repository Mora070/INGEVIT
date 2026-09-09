import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/create-validation-pipe';
import cookieParser from 'cookie-parser';

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


  // Interpreta las cookies antes de ejecutar los guards.
  app.use(cookieParser());

  // Aplica la configuración de validación a las entradas de las rutas.
  app.useGlobalPipes(createValidationPipe());

  // Permite ejecutar los métodos de apagado ante señales como Ctrl+C.
  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  await app.listen(port, host);

  console.log(`Backend disponible en http://${host}:${port}/api/health`);
}

bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exitCode = 1;
});