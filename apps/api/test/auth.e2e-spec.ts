import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ApiErrorResponseSchema,
  AUTH_COOKIES,
  AuthResponseSchema,
  REFRESH_TOKEN_TTL_SECONDS,
  UserSchema,
} from '@rulet/shared';
import { DATABASE, type Database } from '../src/database/database.module.js';
import { sessions } from '../src/database/schema/index.js';
import {
  cookieValue,
  createClient,
  createTestApp,
  resetDatabase,
  setCookies,
  type TestClient,
  uniqueCredentials,
} from './support/app.js';

const ACCESS = AUTH_COOKIES.access.insecure;
const REFRESH = AUTH_COOKIES.refresh.insecure;

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(() => app.close());

  const allSessions = () => app.get<Database>(DATABASE).select().from(sessions);

  describe('mobile (tokens en el cuerpo)', () => {
    let client: TestClient;
    beforeEach(() => {
      client = createClient(app, { platform: 'mobile', origin: null });
    });

    it('register → 201 con tokens y sin cookies', async () => {
      const credentials = uniqueCredentials();
      const res = await client
        .post('/v1/auth/register')
        .send({ ...credentials, email: credentials.email.toUpperCase(), name: 'Ana' })
        .expect(201);

      const body = AuthResponseSchema.parse(res.body);
      expect(body.user).toMatchObject({ email: credentials.email, name: 'Ana', role: 'user' });
      expect(body.tokens).toBeDefined();
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
      // Nunca se exponen datos sensibles del usuario.
      expect(JSON.stringify(res.body)).not.toMatch(/password|argon2/i);
    });

    it('register con email existente → 409 genérico', async () => {
      const credentials = uniqueCredentials();
      await client.post('/v1/auth/register').send(credentials).expect(201);
      const res = await client.post('/v1/auth/register').send(credentials).expect(409);
      expect(res.body.message).toBe('No se ha podido completar el registro');
    });

    it('login → 200 con tokens; credenciales inválidas → 401 genérico', async () => {
      const credentials = uniqueCredentials();
      await client.post('/v1/auth/register').send(credentials).expect(201);

      const ok = await client.post('/v1/auth/login').send(credentials).expect(200);
      expect(AuthResponseSchema.parse(ok.body).tokens).toBeDefined();

      const wrong = await client
        .post('/v1/auth/login')
        .send({ ...credentials, password: 'otra' })
        .expect(401);
      const unknown = await client
        .post('/v1/auth/login')
        .send({ email: 'nadie@rulet.test', password: credentials.password })
        .expect(401);
      expect(wrong.body.message).toBe('Credenciales inválidas');
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('GET /v1/users/me con Bearer', async () => {
      const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const { user, tokens } = AuthResponseSchema.parse(res.body);

      const me = await client
        .get('/v1/users/me')
        .set('authorization', `Bearer ${tokens!.accessToken}`)
        .expect(200);
      expect(UserSchema.parse(me.body)).toEqual(user);
      expect(me.headers['cache-control']).toBe('no-store');
    });

    it('GET /v1/users/me sin token o con token inválido → 401', async () => {
      const none = await client.get('/v1/users/me').expect(401);
      expect(ApiErrorResponseSchema.safeParse(none.body).success).toBe(true);
      await client.get('/v1/users/me').set('authorization', 'Bearer manipulado').expect(401);
    });

    it('refresh rota los tokens', async () => {
      const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const first = AuthResponseSchema.parse(res.body).tokens!;

      const refreshed = await client
        .post('/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const second = AuthResponseSchema.parse(refreshed.body).tokens!;
      expect(second.refreshToken).not.toBe(first.refreshToken);
      await client.get('/v1/users/me').set('authorization', `Bearer ${second.accessToken}`).expect(200);

      const rows = await allSessions();
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((r) => r.familyId)).size).toBe(1);
      // En BD solo hay hashes, nunca los tokens.
      expect(rows.map((r) => r.tokenHash)).not.toContain(first.refreshToken);
    });

    it('reutilizar un refresh token revocado → 401 y revoca toda la familia', async () => {
      const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const first = AuthResponseSchema.parse(res.body).tokens!;
      const refreshed = await client
        .post('/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const second = AuthResponseSchema.parse(refreshed.body).tokens!;

      await client.post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
      expect((await allSessions()).every((r) => r.revokedAt !== null)).toBe(true);
      // El token "legítimo" más reciente también deja de valer.
      await client.post('/v1/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
    });

    it('refresh sin token o con token desconocido → 401', async () => {
      await client.post('/v1/auth/refresh').send({}).expect(401);
      await client.post('/v1/auth/refresh').send({ refreshToken: 'desconocido' }).expect(401);
    });

    it('logout → 204, revoca la sesión y es idempotente', async () => {
      const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const { refreshToken } = AuthResponseSchema.parse(res.body).tokens!;

      await client.post('/v1/auth/logout').send({ refreshToken }).expect(204);
      await client.post('/v1/auth/refresh').send({ refreshToken }).expect(401);
      await client.post('/v1/auth/logout').send({ refreshToken }).expect(204);
      await client.post('/v1/auth/logout').send({}).expect(204);
    });
  });

  describe('web (cookies httpOnly)', () => {
    let client: TestClient;
    beforeEach(() => {
      client = createClient(app, { platform: 'web' });
    });

    it('register → cookies con los atributos correctos y sin tokens en el cuerpo', async () => {
      const res = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);

      const body = AuthResponseSchema.parse(res.body);
      expect(body.tokens).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);

      const cookies = setCookies(res);
      const access = cookies.get(ACCESS)!;
      const refresh = cookies.get(REFRESH)!;
      expect(access).toContain('HttpOnly');
      expect(access).toContain('SameSite=Lax');
      expect(access).toContain('Path=/;');
      expect(access).toContain(`Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`);
      expect(refresh).toContain('HttpOnly');
      expect(refresh).toContain('SameSite=Strict');
      expect(refresh).toContain('Path=/v1/auth');
      expect(refresh).toContain(`Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`);
      for (const cookie of [access, refresh]) {
        expect(cookie).not.toMatch(/Domain=/i);
        // COOKIE_SECURE=false en test (HTTP local); la variante segura se prueba en auth-secure-cookies.
        expect(cookie).not.toMatch(/;\s*Secure/i);
      }
    });

    it('login → cookies; /v1/users/me funciona con la cookie', async () => {
      const credentials = uniqueCredentials();
      await createClient(app, { platform: 'web' }).post('/v1/auth/register').send(credentials).expect(201);

      const login = await client.post('/v1/auth/login').send(credentials).expect(200);
      expect(login.body.tokens).toBeUndefined();
      expect(setCookies(login).has(ACCESS)).toBe(true);

      const me = await client.get('/v1/users/me').expect(200);
      expect(UserSchema.parse(me.body).email).toBe(credentials.email);
    });

    it('refresh lee la cookie, rota y reemite cookies', async () => {
      const registered = await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const firstRefresh = cookieValue(setCookies(registered).get(REFRESH));

      const refreshed = await client.post('/v1/auth/refresh').send({}).expect(200);
      expect(refreshed.body.tokens).toBeUndefined();
      const secondRefresh = cookieValue(setCookies(refreshed).get(REFRESH));
      expect(secondRefresh).toBeDefined();
      expect(secondRefresh).not.toBe(firstRefresh);
      await client.get('/v1/users/me').expect(200);
    });

    it('en web se ignora un refresh token en el cuerpo: solo vale la cookie', async () => {
      const mobile = createClient(app, { platform: 'mobile', origin: null });
      const res = await mobile.post('/v1/auth/register').send(uniqueCredentials()).expect(201);
      const { refreshToken } = AuthResponseSchema.parse(res.body).tokens!;

      await client.post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logout → 204, borra las cookies y revoca la sesión', async () => {
      await client.post('/v1/auth/register').send(uniqueCredentials()).expect(201);

      const res = await client.post('/v1/auth/logout').send({}).expect(204);
      const cookies = setCookies(res);
      expect(cookies.get(ACCESS)).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cookies.get(REFRESH)).toMatch(
        /Path=\/v1\/auth.*Expires=Thu, 01 Jan 1970|Expires=Thu, 01 Jan 1970.*Path=\/v1\/auth/,
      );
      expect((await allSessions()).every((r) => r.revokedAt !== null)).toBe(true);

      await client.get('/v1/users/me').expect(401);
      await client.post('/v1/auth/logout').send({}).expect(204);
    });
  });
});
