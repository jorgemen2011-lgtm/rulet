import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiErrorResponseSchema, AUTH_COOKIES } from '@rulet/shared';
import request from 'supertest';
import { createClient, createTestApp, resetDatabase, uniqueCredentials } from './support/app.js';

describe('Seguridad (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  /** Cliente web ya autenticado (con cookies de auth en el agent). */
  async function loggedInWebClient(origin: string | null) {
    const client = createClient(app, { platform: 'web', origin });
    // El registro se hace sin cookies todavía, así que no le afecta el CSRF.
    await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
    return client;
  }

  describe('CSRF (peticiones con cookies)', () => {
    it('POST con cookie y Origin ajeno → 403', async () => {
      const client = await loggedInWebClient('https://evil.example');
      const res = await client.post('/v1/auth/refresh').send({}).expect(403);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });

    it('POST con cookie y sin Origin → 403', async () => {
      const client = await loggedInWebClient(null);
      await client.post('/v1/auth/logout').send({}).expect(403);
    });

    it('POST con cookie y Origin permitido → ok', async () => {
      const client = await loggedInWebClient('http://localhost:3001');
      await client.post('/v1/auth/refresh').send({}).expect(200);
    });

    it('GET con cookie no exige Origin', async () => {
      const client = await loggedInWebClient(null);
      await client.get('/v1/users/me').expect(200);
    });

    it('una cookie de auth arbitraria también activa la comprobación', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('x-client-platform', 'web')
        .set('cookie', `${AUTH_COOKIES.refresh.secure}=x`)
        .send(uniqueCredentials())
        .expect(403);
    });
  });

  describe('validación de entrada', () => {
    it.each([
      ['register', uniqueCredentials()],
      ['login', uniqueCredentials()],
      ['refresh', {}],
      ['logout', {}],
    ])('/v1/auth/%s sin cabecera de plataforma → 400', async (path, body) => {
      const res = await createClient(app).post(`/v1/auth/${path}`).send(body).expect(400);
      expect(res.body.message).toMatch(/x-client-platform/);
    });

    it('plataforma desconocida → 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('x-client-platform', 'desktop')
        .send(uniqueCredentials())
        .expect(400);
    });

    it('mass assignment: role:"admin" en register → 400', async () => {
      const res = await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/register')
        .send({ ...uniqueCredentials(), role: 'admin' })
        .expect(400);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });

    it('contraseña demasiado corta → 400', async () => {
      await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/register')
        .send({ email: 'ana@rulet.test', password: 'corta' })
        .expect(400);
    });

    it('cuerpo de más de 100kb → 413 con el formato común', async () => {
      const res = await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/login')
        .send({ email: 'ana@rulet.test', password: 'x'.repeat(110 * 1024) })
        .expect(413);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.requestId).toBeDefined();
    });

    it('JSON mal formado → 400 con el formato común', async () => {
      const res = await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/login')
        .set('content-type', 'application/json')
        .send('{"email":')
        .expect(400);
      expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
    });
  });

  describe('rate limiting', () => {
    it('login: a partir del 6.º intento en un minuto desde la misma IP → 429', async () => {
      const client = createClient(app, { platform: 'mobile' });
      const credentials = uniqueCredentials();
      for (let i = 0; i < 5; i += 1) await client.post('/v1/auth/login').send(credentials).expect(401);
      await client.post('/v1/auth/login').send(credentials).expect(429);
      // Otra IP no se ve afectada.
      await createClient(app, { platform: 'mobile' }).post('/v1/auth/login').send(credentials).expect(401);
    });

    it('register: a partir del 4.º en un minuto desde la misma IP → 429', async () => {
      const client = createClient(app, { platform: 'mobile' });
      for (let i = 0; i < 3; i += 1)
        await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      await client.post('/v1/auth/register').send(uniqueCredentials()).expect(429);
    });
  });
});
