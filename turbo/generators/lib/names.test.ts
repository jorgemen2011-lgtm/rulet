import { describe, expect, it } from 'vitest';
import { deriveNames, singularize, validateKebabName } from './names';

describe('validateKebabName', () => {
  it.each(['tasks', 'order-items', 'v2-reports'])('acepta "%s"', (name) => {
    expect(validateKebabName(name)).toBe(true);
  });

  it.each(['', 'Tasks', 'order_items', 'order--items', '-tasks', 'tasks-', '2fa', '../etc', 'a b'])(
    'rechaza "%s"',
    (name) => {
      expect(validateKebabName(name)).toEqual(expect.any(String));
    },
  );

  it('rechaza palabras reservadas, nombres del repo y nombres demasiado largos', () => {
    expect(validateKebabName('delete')).toMatch(/reservada/);
    expect(validateKebabName('common')).toMatch(/reservado/);
    expect(validateKebabName('a'.repeat(41))).toMatch(/Máximo/);
  });
});

describe('singularize', () => {
  it.each([
    ['users', 'user'],
    ['order-items', 'order-item'],
    ['categories', 'category'],
    ['addresses', 'address'],
    ['boxes', 'box'],
    ['status', 'status'],
    ['analysis', 'analysis'],
    ['news', 'new'],
    ['inventory', 'inventory'],
  ])('%s → %s (solo es el valor por defecto del prompt)', (plural, singular) => {
    expect(singularize(plural)).toBe(singular);
  });
});

describe('deriveNames', () => {
  it('deriva todos los identificadores desde kebab-case', () => {
    expect(deriveNames('order-items', 'order-item')).toEqual({
      name: 'order-items',
      namePascal: 'OrderItems',
      nameCamel: 'orderItems',
      nameSnake: 'order_items',
      entity: 'order-item',
      entityPascal: 'OrderItem',
    });
  });
});
