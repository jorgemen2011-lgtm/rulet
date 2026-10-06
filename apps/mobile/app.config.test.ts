import { describe, expect, it } from 'vitest';
import { resolveVariant } from './app.config';

describe('resolveVariant', () => {
  it('sin APP_VARIANT en local asume desarrollo', () => {
    expect(resolveVariant(undefined, false)).toBe('development');
  });

  it('sin APP_VARIANT en una build de EAS falla en vez de caer en desarrollo', () => {
    expect(() => resolveVariant(undefined, true)).toThrow(/obligatoria en las builds de EAS/);
  });

  it.each(['development', 'preview', 'production'])('acepta "%s" en local y en EAS', (variant) => {
    expect(resolveVariant(variant, false)).toBe(variant);
    expect(resolveVariant(variant, true)).toBe(variant);
  });

  it('rechaza valores desconocidos', () => {
    expect(() => resolveVariant('prod', false)).toThrow(/APP_VARIANT inválida/);
    expect(() => resolveVariant('', true)).toThrow(/APP_VARIANT inválida/);
  });
});
