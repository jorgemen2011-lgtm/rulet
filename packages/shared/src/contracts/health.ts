import { z } from 'zod';

/** `GET /health` — liveness: el proceso responde. No toca dependencias. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptime: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});

/** `GET /health/ready` — readiness: el proceso puede atender tráfico (BD accesible). */
export const ReadinessResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  checks: z.record(z.string(), z.enum(['up', 'down'])),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
