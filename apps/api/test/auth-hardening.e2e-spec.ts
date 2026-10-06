import type { NestExpressApplication } from '@nestjs/platform-express';
import { AUTH_COOKIES, AuthResponseSchema } from '@rulet/shared';
import { eq } from 'drizzle-orm';
import { Client } from 'pg';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { sessions } from '../src/database/schema/index.js';
import { hashRefreshToken } from '../src/modules/auth/refresh-token.js';
import { SessionsRepository } from '../src/modules/auth/sessions.repository.js';
import {
  cookieValue,
  createClient,
  createTestApp,
  resetDatabase,
  setCookies,
  uniqueCredentials,
} from './support/app.js';
import { e2eDatabaseUrl } from './test-env.js';

const REFRESH = AUTH_COOKIES.refresh.insecure;

describe('Endurecimiento de auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  const db = () => app.get<Database>(DATABASE);
  const sessionOf = async (refreshToken: string) => {
    const [row] = await db()
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashRefreshToken(refreshToken)));
    return row!;
  };

  async function registerMobile() {
    const res = await createClient(app, { platform: 'mobile', origin: null })
      .post('/v1/auth/register')
      .send(uniqueCredentials())
      .expect(201);
    return AuthResponseSchema.parse(res.body).tokens!;
  }

  async function registerWeb(): Promise<string> {
    const res = await createClient(app, { platform: 'web' })
      .post('/v1/auth/register')
      .send(uniqueCredentials());
    return cookieValue(setCookies(res).get(REFRESH))!;
  }

  describe('límite de login por cuenta', () => {
    it('a partir del 11.º intento en 15 min contra la misma cuenta → 429, aunque cada uno llegue de otra IP', async () => {
      const { email, password } = uniqueCredentials();
      // Variantes del mismo email: el límite va por el email normalizado.
      const variants = [email, email.toUpperCase(), `  ${email} `];
      for (let i = 0; i < 10; i += 1) {
        await createClient(app, { platform: 'mobile' })
          .post('/v1/auth/login')
          .send({ email: variants[i % variants.length], password })
          .expect(401);
      }
      const blocked = await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(429);
      // Mismo 429 que el límite por IP: no hay cabeceras que distingan el límite por cuenta.
      expect(Object.keys(blocked.headers).some((h) => h.endsWith('-account'))).toBe(false);

      // Otra cuenta no se ve afectada.
      await createClient(app, { platform: 'mobile' })
        .post('/v1/auth/login')
        .send({ ...uniqueCredentials() })
        .expect(401);
    });

    it('no se aplica a otras rutas', async () => {
      const { email } = uniqueCredentials();
      for (let i = 0; i < 11; i += 1) {
        await createClient(app, { platform: 'mobile' })
          .post('/v1/auth/register')
          .send({ email, password: 'contraseña-de-test-larga' })
          .expect(i === 0 ? 201 : 409);
      }
    });
  });

  describe('cookie de refresh repetida (cookie tossing desde un subdominio)', () => {
    it('refresh con la cookie duplicada → 401 y borra todas las variantes de Path y Domain', async () => {
      const valid = await registerWeb();
      const res = await createClient(app, { platform: 'web' })
        .post('/v1/auth/refresh')
        .set('host', 'api.rulet.test')
        // La plantada llega primero (Path más largo): cookie-parser se quedaría con ella.
        .set('cookie', `${REFRESH}=plantada; ${REFRESH}=${valid}`)
        .send({})
        .expect(401);

      const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
      const cleared = setCookie.filter((c) => c.startsWith(`${REFRESH}=;`));
      for (const variant of [
        `${REFRESH}=; Path=/v1/auth/refresh;`,
        `${REFRESH}=; Domain=rulet.test; Path=/v1/auth/refresh;`,
        `${REFRESH}=; Domain=api.rulet.test; Path=/v1/auth;`,
        `${REFRESH}=; Path=/;`,
      ]) {
        expect(cleared.some((c) => c.startsWith(variant))).toBe(true);
      }
      expect(cleared.every((c) => /Expires=Thu, 01 Jan 1970/.test(c))).toBe(true);
      // Ninguna cookie de refresh nueva: la sesión es ambigua.
      expect(setCookie.filter((c) => c.startsWith(`${REFRESH}=`) && !cleared.includes(c))).toEqual([]);
    });

    it('logout con la cookie duplicada revoca también la sesión auténtica', async () => {
      const victim = await registerWeb();
      const planted = await registerWeb();
      await createClient(app, { platform: 'web' })
        .post('/v1/auth/logout')
        .set('cookie', `${REFRESH}=${planted}; ${REFRESH}=${victim}`)
        .send({})
        .expect(204);

      for (const token of [victim, planted]) {
        await createClient(app, { platform: 'web' })
          .post('/v1/auth/refresh')
          .set('cookie', `${REFRESH}=${token}`)
          .send({})
          .expect(401);
      }
    });

    it('una única cookie sigue funcionando', async () => {
      const valid = await registerWeb();
      await createClient(app, { platform: 'web' })
        .post('/v1/auth/refresh')
        .set('cookie', `${REFRESH}=${valid}`)
        .send({})
        .expect(200);
    });
  });

  describe('carrera entre revocar la familia y una rotación en curso', () => {
    /** Espera a que haya `count` consultas de la API bloqueadas esperando un lock. */
    async function waitForBlocked(observer: Client, count: number): Promise<void> {
      for (let i = 0; i < 200; i += 1) {
        const { rows } = await observer.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity
           WHERE application_name = 'rulet-api' AND wait_event_type = 'Lock' AND datname = current_database()`,
        );
        if ((rows[0]?.n ?? 0) >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`No se llegó a ${count} consultas bloqueadas`);
    }

    it('revokeFamily espera a la rotación y revoca también el token hijo', async () => {
      const tokens = await registerMobile();
      const current = await sessionOf(tokens.refreshToken);
      const repo = app.get(SessionsRepository);

      // Otra conexión retiene la fila actual para que la rotación quede a medias.
      const holder = new Client({ connectionString: e2eDatabaseUrl });
      const observer = new Client({ connectionString: e2eDatabaseUrl });
      await Promise.all([holder.connect(), observer.connect()]);
      try {
        await holder.query('BEGIN');
        await holder.query('SELECT id FROM sessions WHERE id = $1 FOR UPDATE', [current.id]);

        const nextId = crypto.randomUUID();
        const rotation = repo.rotate(current.id, {
          id: nextId,
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: hashRefreshToken('token-hijo'),
          expiresAt: current.expiresAt,
          familyExpiresAt: current.familyExpiresAt,
        });
        await waitForBlocked(observer, 1);
        // Logout (o reutilización detectada) mientras la rotación está en curso.
        const revocation = repo.revokeFamily(current.familyId);
        await waitForBlocked(observer, 2);
        await holder.query('COMMIT');

        await expect(rotation).resolves.toBe(true);
        await revocation;
        const family = await db().select().from(sessions).where(eq(sessions.familyId, current.familyId));
        expect(family.map((s) => s.id).sort()).toEqual([current.id, nextId].sort());
        expect(family.every((s) => s.revokedAt !== null)).toBe(true);
      } finally {
        await holder.query('ROLLBACK').catch(() => undefined);
        await Promise.all([holder.end(), observer.end()]);
      }
    });
  });
});
