import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  await app.listen(3000, '127.0.0.1');

  console.log('Backend disponible en http://127.0.0.1:3000/api');
}

bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar el backend:', error);
  process.exitCode = 1;
});