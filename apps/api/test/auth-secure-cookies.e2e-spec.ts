import type { NestExpressApplication } from '@nestjs/platform-express';
import { AUTH_COOKIES } from '@rulet/shared';

// Variante de producción (HTTPS): debe fijarse ANTES de importar la app, que valida el entorno al cargarse.
vi.stubEnv('COOKIE_SECURE', 'true');
const { createClient, createTestApp, resetDatabase, setCookies, uniqueCredentials, cookieValue } =
  await import('./support/app.js');

describe('Auth con COOKIE_SECURE=true (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase(app));
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('usa los prefijos __Host-/__Secure- y el atributo Secure', async () => {
    const res = await createClient(app, { platform: 'web' })
      .post('/v1/auth/register')
      .send(uniqueCredentials())
      .expect(201);
    const cookies = setCookies(res);

    const access = cookies.get(AUTH_COOKIES.access.secure);
    const refresh = cookies.get(AUTH_COOKIES.refresh.secure);
    expect(access).toMatch(/; Secure/);
    expect(access).toContain('Path=/;');
    expect(access).not.toMatch(/Domain=/i);
    expect(refresh).toMatch(/; Secure/);
    expect(refresh).toContain('Path=/v1/auth');
    expect(cookies.has(AUTH_COOKIES.access.insecure)).toBe(false);

    // El guard lee la cookie con el nombre seguro.
    const me = await createClient(app, { platform: 'web' })
      .get('/v1/users/me')
      .set('cookie', `${AUTH_COOKIES.access.secure}=${cookieValue(access)}`)
      .expect(200);
    expect(me.body.email).toBe(res.body.user.email);
  });
});
