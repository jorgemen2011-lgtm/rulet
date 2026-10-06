import { Injectable, Logger } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@rulet/shared';
import { AppConfigService } from '../../config/app-config.service.js';
import { HealthRepository } from './health.repository.js';

// Una sonda de readiness debe responder rápido aunque la BD esté colgada.
const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tiempo de espera agotado (${ms} ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly health: HealthRepository,
  ) {}

  /** Liveness: el proceso responde. No toca dependencias para que una caída de la BD no provoque reinicios. */
  liveness(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.get('APP_VERSION'),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: el proceso puede atender tráfico (dependencias accesibles). */
  async readiness(): Promise<ReadinessResponse> {
    const database = await withTimeout(this.health.pingDatabase(), CHECK_TIMEOUT_MS).then(
      () => 'up' as const,
      (err: unknown) => {
        this.logger.warn(`Base de datos no disponible: ${err instanceof Error ? err.message : String(err)}`);
        return 'down' as const;
      },
    );
    return { status: database === 'up' ? 'ok' : 'error', checks: { database } };
  }
}
