import { Injectable } from '@nestjs/common';
import { hash, type Options, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

/**
 * Parámetros mínimos recomendados por OWASP para argon2id (19 MiB, 2 iteraciones, 1 hilo).
 * El algoritmo por defecto de @node-rs/argon2 es argon2id (su enum es `const` y no se puede
 * importar con `isolatedModules`); un test unitario comprueba que el hash empieza por `$argon2id$`.
 */
export const ARGON2_OPTIONS: Readonly<Options> = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

@Injectable()
export class PasswordHasher {
  // Hash de una contraseña aleatoria, calculado una vez al arrancar con los mismos parámetros.
  private readonly dummyHash: Promise<string> = hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // Hash corrupto o con formato desconocido: nunca autentica.
      return false;
    }
  }

  /**
   * Verificación contra el hash ficticio cuando el email no existe: el login tarda lo mismo
   * exista o no la cuenta, y así no se puede enumerar usuarios midiendo tiempos. Siempre `false`.
   */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
