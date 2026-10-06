import { describe, expect, it } from 'vitest';
import { validateLogin, validateRegister } from './validation';

describe('validateLogin', () => {
  it('normaliza el email y devuelve el cuerpo de la petición', () => {
    expect(validateLogin({ email: '  Ana@Example.COM ', password: 'x' })).toEqual({
      ok: true,
      data: { email: 'ana@example.com', password: 'x' },
    });
  });

  it('da un mensaje por campo inválido', () => {
    expect(validateLogin({ email: 'no-es-un-email', password: '' })).toEqual({
      ok: false,
      errors: { email: 'Introduce un email válido', password: 'Introduce tu contraseña' },
    });
  });
});

describe('validateRegister', () => {
  const VALID = {
    name: '',
    email: 'ana@example.com',
    password: 'una frase de paso larga',
    confirmPassword: 'una frase de paso larga',
  };

  it('omite el nombre vacío (el contrato es estricto y no admite cadenas vacías)', () => {
    expect(validateRegister({ ...VALID, name: '   ' })).toEqual({
      ok: true,
      data: { email: 'ana@example.com', password: VALID.password },
    });
  });

  it('envía el nombre recortado cuando lo hay, y nunca la confirmación', () => {
    const result = validateRegister({ ...VALID, name: '  Ana  ' });
    expect(result).toEqual({
      ok: true,
      data: { email: 'ana@example.com', password: VALID.password, name: 'Ana' },
    });
  });

  it('aplica la política de contraseñas con el mensaje del contrato', () => {
    const result = validateRegister({ ...VALID, password: 'corta', confirmPassword: 'corta' });
    expect(result).toEqual({
      ok: false,
      errors: { password: 'La contraseña debe tener al menos 12 caracteres' },
    });
  });

  it('exige que la confirmación coincida aunque el resto sea válido', () => {
    expect(validateRegister({ ...VALID, confirmPassword: 'otra frase de paso larga' })).toEqual({
      ok: false,
      errors: { confirmPassword: 'Las contraseñas no coinciden' },
    });
  });

  it('acumula los errores de todos los campos', () => {
    const result = validateRegister({
      name: 'a'.repeat(101),
      email: 'mal',
      password: 'corta',
      confirmPassword: 'distinta',
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        name: 'El nombre no puede superar 100 caracteres',
        email: 'Introduce un email válido',
        password: 'La contraseña debe tener al menos 12 caracteres',
        confirmPassword: 'Las contraseñas no coinciden',
      },
    });
  });
});
