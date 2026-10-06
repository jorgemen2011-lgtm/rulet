import { ConsoleLogger, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service.js';

/**
 * Configuración HTTP de la aplicación. Se comparte entre `main.ts` y los tests e2e
 * para que los tests ejerciten exactamente lo mismo que producción.
 */
export function setupApp(app: NestExpressApplication): AppConfigService {
  const config = app.get(AppConfigService);

  app.useLogger(new ConsoleLogger({ json: config.isProduction, colors: !config.isProduction }));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  return config;
}
