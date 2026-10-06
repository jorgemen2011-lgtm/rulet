import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiErrorResponseSchema, HealthResponseSchema, ReadinessResponseSchema } from '@rulet/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { Public } from '../src/common/decorators/public.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { RequireFeature } from '../src/common/guards/feature.guard.js';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { users } from '../src/database/schema/index.js';
import {
  ALLOWED_ORIGIN,
  createClient,
  createTestApp,
  resetDatabase,
  uniqueCredentials,
} from './support/app.js';

@Public()
@Controller('feature-probe')
@RequireFeature('adminPanel')
class FeatureProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

@Controller('protected-probe')
class ProtectedProbeController {
  @Get()
  get() {
    return { ok: true };
  }

  @Get('admin')
  @Roles('admin')
  admin() {
    return { ok: true };
  }
}

describe('API (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp([FeatureProbeController, ProtectedProbeController]);
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  describe('salud', () => {
    it('GET /health responde según el contrato y con request id', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('GET /health/ready comprueba la base de datos', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(ReadinessResponseSchema.parse(res.body)).toEqual({ status: 'ok', checks: { database: 'up' } });
    });
  });

  describe('cabeceras HTTP', () => {
    it('aplica helmet, oculta x-powered-by y no cachea', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('reutiliza un x-request-id seguro y sustituye uno malicioso', async () => {
      const ok = await request(app.getHttpServer())
        .get('/health')
        .set('x-request-id', 'lb-123.abc')
        .expect(200);
      expect(ok.headers['x-request-id']).toBe('lb-123.abc');
      const bad = await request(app.getHttpServer())
        .get('/health')
        .set('x-request-id', 'a b<script>')
        .expect(200);
      expect(bad.headers['x-request-id']).not.toBe('a b<script>');
    });

    it('CORS: preflight del origen permitido con las cabeceras explícitas', async () => {
      const res = await request(app.getHttpServer())
        .options('/v1/auth/login')
        .set('origin', ALLOWED_ORIGIN)
        .set('access-control-request-method', 'POST')
        .set('access-control-request-headers', 'content-type,x-client-platform')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-headers']).toBe(
        'content-type,authorization,x-client-platform,x-request-id',
      );
      expect(res.headers['access-control-expose-headers']).toBe('x-request-id');
    });

    it('CORS: no autoriza orígenes ajenos', async () => {
      const res = await request(app.getHttpServer())
        .options('/v1/auth/login')
        .set('origin', 'https://evil.example')
        .set('access-control-request-method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('versionado y funcionalidades', () => {
    it('las rutas de dominio están versionadas en /v1', async () => {
      await createClient(app, { platform: 'web' }).get('/v1/feature-probe').expect(200);
    });

    it('bloquea funcionalidades no disponibles en la plataforma', async () => {
      const res = await createClient(app, { platform: 'mobile' }).get('/v1/feature-probe').expect(403);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });

    it('los errores 404 usan el formato común', async () => {
      const res = await request(app.getHttpServer()).get('/v1/no-existe').expect(404);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });
  });

  describe('autorización por defecto', () => {
    it('una ruta sin @Public() exige token (401)', async () => {
      const res = await request(app.getHttpServer()).get('/v1/protected-probe').expect(401);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });

    it('@Roles("admin"): 403 para un usuario normal y 200 para un admin', async () => {
      const client = createClient(app, { platform: 'mobile' });
      const credentials = uniqueCredentials();
      const registered = await client.post('/v1/auth/register').send(credentials).expect(201);
      const userToken = registered.body.tokens.accessToken as string;

      await client.get('/v1/protected-probe').set('authorization', `Bearer ${userToken}`).expect(200);
      await client.get('/v1/protected-probe/admin').set('authorization', `Bearer ${userToken}`).expect(403);

      await app
        .get<Database>(DATABASE)
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.email, credentials.email));
      const login = await client.post('/v1/auth/login').send(credentials).expect(200);
      await client
        .get('/v1/protected-probe/admin')
        .set('authorization', `Bearer ${login.body.tokens.accessToken as string}`)
        .expect(200);
    });
  });
});
