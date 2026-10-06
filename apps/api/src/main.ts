import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = setupApp(app);
  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API escuchando en el puerto ${port} (${config.get('NODE_ENV')})`, 'Bootstrap');
}

await bootstrap();
