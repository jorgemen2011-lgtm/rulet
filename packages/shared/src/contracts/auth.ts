import { z } from 'zod';
import { UserSchema } from './users';

/** Normaliza el email para que `Ana@X.com` y `ana@x.com` sean la misma cuenta. */
const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Email inválido' }).max(254));

/**
 * Política de contraseñas según NIST SP 800-63B: longitud mínima generosa, máximo amplio
 * (frases de paso) y sin reglas de composición arbitrarias.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres');

// `strictObject`: se rechazan campos desconocidos (evita mass assignment).
export const RegisterRequestSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().trim().min(1).max(100).optional(),
});

export const LoginRequestSchema = z.strictObject({
  email: EmailSchema,
  // En login no se aplica la política: solo se comprueba contra el hash.
  password: z.string().min(1).max(128),
});

/** Móvil envía el refresh token en el cuerpo; web lo envía en una cookie httpOnly y deja el cuerpo vacío. */
export const RefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(512).optional(),
});

export const LogoutRequestSchema = RefreshRequestSchema;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
});

/**
 * Respuesta de register/login/refresh.
 * - `mobile`: incluye `tokens` (se guardan en el almacén seguro del dispositivo).
 * - `web`: NO incluye `tokens`; la API los entrega en cookies httpOnly inaccesibles para JavaScript.
 */
export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema.optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
