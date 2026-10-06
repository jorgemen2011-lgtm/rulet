import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { CLIENT_PLATFORM_HEADER, type Platform } from '@rulet/shared';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { DATABASE, type Database } from '../../src/database/database.module.js';

export const ALLOWED_ORIGIN = 'http://localhost:3001';

/** Levanta la aplicación real (mismo `setupApp` que producción) contra la BD de test. */
export async function createTestApp(extraControllers: Type[] = []): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] });
  setupApp(app);
  await app.init();
  return app;
}

/** Vacía las tablas entre tests para que cada uno empiece de cero. */
export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app.get<Database>(DATABASE).execute(sql`TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE`);
}

let ipCounter = 0;

/**
 * Cada cliente simula una IP distinta (vía `X-Forwarded-For`, que se acepta porque supertest conecta desde
 * loopback y TRUST_PROXY vale `loopback` fuera de producción) para que el rate limiting por IP de un test
 * no afecte a los demás.
 */
function nextIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export interface ClientOptions {
  platform?: Platform;
  /** Cabecera Origin; `null` para no enviarla. Por defecto el origen permitido. */
  origin?: string | null;
}

/**
 * Cliente HTTP de test. En web usa un `agent` de supertest, que guarda y reenvía cookies
 * respetando su `Path` como haría un navegador.
 */
export function createClient(app: NestExpressApplication, options: ClientOptions = {}) {
  const ip = nextIp();
  const agent = request.agent(app.getHttpServer());
  const origin = options.origin === undefined ? ALLOWED_ORIGIN : options.origin;

  const prepare = (test: request.Test): request.Test => {
    test.set('x-forwarded-for', ip);
    if (options.platform) test.set(CLIENT_PLATFORM_HEADER, options.platform);
    if (origin) test.set('origin', origin);
    return test;
  };

  return {
    ip,
    get: (path: string) => prepare(agent.get(path)),
    post: (path: string) => prepare(agent.post(path)),
    delete: (path: string) => prepare(agent.delete(path)),
  };
}

export type TestClient = ReturnType<typeof createClient>;

let emailCounter = 0;

export function uniqueCredentials() {
  emailCounter += 1;
  return { email: `user${emailCounter}-${Date.now()}@rulet.test`, password: 'contraseña-de-test-larga' };
}

/** Cabeceras `Set-Cookie` de una respuesta, indexadas por nombre de cookie. */
export function setCookies(res: request.Response): Map<string, string> {
  const raw = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  return new Map(list.map((cookie) => [cookie.slice(0, cookie.indexOf('=')), cookie]));
}

/** Valor de una cookie a partir de su cabecera `Set-Cookie`. */
export function cookieValue(setCookie: string | undefined): string | undefined {
  if (!setCookie) return undefined;
  const pair = setCookie.split(';')[0] ?? '';
  return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
}
