import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('usa argon2id con los parámetros de OWASP y sal aleatoria', async () => {
    const a = await hasher.hash('una frase de paso larga');
    const b = await hasher.hash('una frase de paso larga');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('una frase de paso larga');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hasher.hash('contraseña-correcta');
    await expect(hasher.verify(hash, 'contraseña-correcta')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'contraseña-incorrecta')).resolves.toBe(false);
  });

  it('un hash corrupto nunca autentica (sin lanzar)', async () => {
    await expect(hasher.verify('no-es-un-hash', 'lo-que-sea')).resolves.toBe(false);
  });

  it('verifyDummy siempre devuelve false', async () => {
    await expect(hasher.verifyDummy('lo-que-sea')).resolves.toBe(false);
  });
});
