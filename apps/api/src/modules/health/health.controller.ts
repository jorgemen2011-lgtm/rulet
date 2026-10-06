import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@rulet/shared';
import { AppConfigService } from '../../config/app-config.service';

/** Sonda de salud para el balanceador/orquestador. Fuera del versionado: `GET /health`. */
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.get('APP_VERSION'),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
