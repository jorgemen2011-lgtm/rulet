import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse, ReadinessResponse } from '@rulet/shared';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

/** Sondas para el balanceador/orquestador. Fuera del versionado: `GET /health` y `GET /health/ready`. */
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): HealthResponse {
    return this.health.liveness();
  }

  /** 503 si alguna dependencia falla, para que el balanceador deje de enviar tráfico a esta instancia. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const result = await this.health.readiness();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
