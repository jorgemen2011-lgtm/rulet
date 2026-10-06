import { describe, expect, it } from 'vitest';
import { devDefaultApiUrl, parseVariant, readApiUrl } from './env-config';

describe('parseVariant', () => {
  it.each(['development', 'preview', 'production'] as const)('acepta "%s"', (variant) => {
    expect(parseVariant(variant)).toBe(variant);
  });

  it.each([undefined, null, '', 'prod', 'Development', 42])('ante %j asume production', (raw) => {
    expect(parseVariant(raw)).toBe('production');
  });
});

describe('devDefaultApiUrl', () => {
  it('en Android apunta al host del emulador y en el resto a localhost', () => {
    expect(devDefaultApiUrl('android')).toBe('http://10.0.2.2:3000');
    expect(devDefaultApiUrl('ios')).toBe('http://localhost:3000');
  });
});

describe('readApiUrl', () => {
  const DEV_DEFAULT = 'http://localhost:3000';

  describe('en desarrollo', () => {
    it('usa el valor por defecto si la variable falta o está en blanco', () => {
      expect(readApiUrl('development', undefined, DEV_DEFAULT)).toBe(DEV_DEFAULT);
      expect(readApiUrl('development', '   ', DEV_DEFAULT)).toBe(DEV_DEFAULT);
    });

    it('admite http y https, recortando espacios', () => {
      expect(readApiUrl('development', ' http://192.168.1.20:3000 ', DEV_DEFAULT)).toBe(
        'http://192.168.1.20:3000',
      );
      expect(readApiUrl('development', 'https://api.example.com', DEV_DEFAULT)).toBe(
        'https://api.example.com',
      );
    });

    it('rechaza otros protocolos y valores que no son URL', () => {
      expect(() => readApiUrl('development', 'ftp://api.example.com', DEV_DEFAULT)).toThrow();
      expect(() => readApiUrl('development', 'api.example.com', DEV_DEFAULT)).toThrow();
    });
  });

  describe.each(['preview', 'production'] as const)('en %s', (variant) => {
    it('exige la variable: no hay valor por defecto', () => {
      expect(() => readApiUrl(variant, undefined, DEV_DEFAULT)).toThrow(/obligatoria/);
      expect(() => readApiUrl(variant, '  ', DEV_DEFAULT)).toThrow(/obligatoria/);
    });

    it('exige https', () => {
      expect(readApiUrl(variant, 'https://api.rulet.app', DEV_DEFAULT)).toBe('https://api.rulet.app');
      expect(() => readApiUrl(variant, 'http://api.rulet.app', DEV_DEFAULT)).toThrow(/https/);
    });
  });
});
