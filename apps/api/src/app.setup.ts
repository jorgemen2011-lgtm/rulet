import { ConsoleLogger, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CLIENT_PLATFORM_HEADER } from '@rulet/shared';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { bodyParserErrorHandler } from './common/middleware/body-parser-error.handler.js';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { AppConfigService } from './config/app-config.service.js';

const BODY_LIMIT = '100kb';

/** Las respuestas de la API contienen datos de usuario: no se cachean salvo que una ruta lo indique (`@Header`). */
function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Configuración HTTP de la aplicación. Se comparte entre `main.ts` y los tests e2e
 * para que los tests ejerciten exactamente lo mismo que producción.
 * El orden de los middlewares importa: request id primero, parsers después y su manejador de errores al final.
 */
export function setupApp(app: NestExpressApplication): AppConfigService {
  const config = app.get(AppConfigService);

  app.useLogger(
    new ConsoleLogger({
      json: config.isProduction,
      colors: !config.isProduction,
      // En los tests solo interesa lo anómalo; el resto es ruido.
      logLevels: config.get('NODE_ENV') === 'test' ? ['warn', 'error', 'fatal'] : undefined,
    }),
  );
  // Proxies de confianza según la topología del despliegue (TRUST_PROXY, ver env.ts): de ello depende que
  // `req.ip`, la clave del rate limiting, sea la IP real del cliente y no una elegida en `X-Forwarded-For`.
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(noStore);
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', CLIENT_PLATFORM_HEADER, REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  });
  // Registrar los parsers aquí hace que Nest no añada los suyos por defecto (sin límite explícito).
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_LIMIT, extended: false });
  app.use(bodyParserErrorHandler);
  app.use(cookieParser());

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  return config;
}
