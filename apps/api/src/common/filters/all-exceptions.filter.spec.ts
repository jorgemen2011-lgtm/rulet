import { type ArgumentsHost, Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { AllExceptionsFilter, describeError } from './all-exceptions.filter.js';

const EMAIL = 'victima@example.com';
const PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$SALT$HASH-SECRETO';
const QUERY = 'insert into "users" ("email", "password_hash") values ($1, $2)';

/** Error de consulta tal y como lo lanza Drizzle cuando falla `pg` (timeout, failover…). */
function queryError(): DrizzleQueryError {
  const cause = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
  return new DrizzleQueryError(QUERY, [EMAIL, PASSWORD_HASH], cause);
}

function host(): { host: ArgumentsHost; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) };
  const req = { url: '/v1/auth/register', header: () => 'req-1' };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, json };
}

describe('AllExceptionsFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no registra los parámetros de una consulta fallida (email, hash de contraseña)', () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host: h, json } = host();

    new AllExceptionsFilter().catch(queryError(), h);

    expect(logged).toHaveBeenCalledTimes(1);
    const output = JSON.stringify(logged.mock.calls);
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain('HASH-SECRETO');
    // Sigue habiendo lo necesario para diagnosticar: consulta con marcadores, código de pg y traza.
    expect(output).toContain('insert into \\"users\\"');
    expect(output).toContain('57014');
    expect(output).toContain('statement timeout');
    expect(logged.mock.calls[0]?.[1]).toMatch(/^\s+at /);
    // Al cliente, mensaje genérico.
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Error interno del servidor' }),
    );
  });

  it('del resto de errores registra nombre, mensaje y traza, nunca el objeto completo', () => {
    const error = Object.assign(new TypeError('boom'), { secret: 'no-debe-salir' });
    const described = describeError(error);
    expect(described.error).toEqual({ name: 'TypeError', message: 'boom' });
    expect(described.stack).toContain('TypeError: boom');
    expect(JSON.stringify(described)).not.toContain('no-debe-salir');
    expect(describeError('texto').error).toEqual({ name: 'NonError', message: 'texto' });
  });
});
