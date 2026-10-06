export const PLATFORMS = ['web', 'mobile'] as const;

export type Platform = (typeof PLATFORMS)[number];

/** Cabecera con la que cada cliente indica su plataforma a la API. */
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);
}
