import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema, ReadinessResponseSchema } from '@rulet/shared';
import type { Response } from 'express';
import { AppConfigModule } from '../../config/config.module.js';
import { HealthController } from './health.controller.js';
import { HealthRepository } from './health.repository.js';
import { HealthService } from './health.service.js';

async function setup(pingDatabase: () => Promise<void>) {
  const moduleRef = await Test.createTestingModule({
    imports: [AppConfigModule],
    controllers: [HealthController],
    providers: [HealthService, { provide: HealthRepository, useValue: { pingDatabase } }],
  }).compile();
  const res = { status: vi.fn() };
  return { controller: moduleRef.get(HealthController), res, response: res as unknown as Response };
}

describe('HealthController', () => {
  it('liveness cumple el contrato HealthResponse', async () => {
    const { controller } = await setup(async () => undefined);
    expect(HealthResponseSchema.safeParse(controller.check()).success).toBe(true);
  });

  it('readiness: 200 si la BD responde', async () => {
    const { controller, res, response } = await setup(async () => undefined);
    const result = await controller.ready(response);
    expect(ReadinessResponseSchema.parse(result)).toEqual({ status: 'ok', checks: { database: 'up' } });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('readiness: 503 si la BD falla', async () => {
    const { controller, res, response } = await setup(() => Promise.reject(new Error('ECONNREFUSED')));
    const result = await controller.ready(response);
    expect(result).toEqual({ status: 'error', checks: { database: 'down' } });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
