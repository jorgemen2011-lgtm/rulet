import { ApiError } from '@rulet/api-client';
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './errors';

const httpError = (status: number) =>
  new ApiError(status, {
    statusCode: status,
    error: 'Error',
    message: 'texto del servidor',
    path: '/v1/auth/login',
    timestamp: '2026-01-01T00:00:00.000Z',
  });

describe('authErrorMessage', () => {
  it('traduce los fallos de red y de timeout a un mensaje de conexión', () => {
    for (const code of ['network', 'timeout'] as const) {
      expect(authErrorMessage(new ApiError(0, null, { code }), 'login')).toMatch(/conectar/);
    }
  });

  it('avisa del rate limiting en ambas acciones', () => {
    expect(authErrorMessage(httpError(429), 'login')).toMatch(/Demasiados intentos/);
    expect(authErrorMessage(httpError(429), 'register')).toMatch(/Demasiados intentos/);
  });

  it('en el login, un 401 son credenciales incorrectas', () => {
    expect(authErrorMessage(httpError(401), 'login')).toBe('Email o contraseña incorrectos.');
  });

  it('en el registro, 400 y 409 dan el mismo mensaje para no revelar si el email existe', () => {
    const conflict = authErrorMessage(httpError(409), 'register');
    expect(conflict).toBe('No se ha podido completar el registro.');
    expect(authErrorMessage(httpError(400), 'register')).toBe(conflict);
  });

  it('nunca muestra el texto del servidor', () => {
    for (const status of [400, 401, 403, 409, 500]) {
      for (const action of ['login', 'register'] as const) {
        expect(authErrorMessage(httpError(status), action)).not.toContain('texto del servidor');
      }
    }
  });

  it('cualquier otra cosa es un error genérico', () => {
    const unexpected = 'Ha ocurrido un error. Inténtalo de nuevo.';
    expect(authErrorMessage(new Error('boom'), 'login')).toBe(unexpected);
    expect(authErrorMessage(httpError(500), 'register')).toBe(unexpected);
    expect(authErrorMessage(httpError(401), 'register')).toBe(unexpected);
    expect(authErrorMessage(new ApiError(200, null, { code: 'invalid_response' }), 'login')).toBe(unexpected);
  });
});
