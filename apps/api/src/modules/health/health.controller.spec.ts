import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@rulet/shared';
import { AppConfigModule } from '../../config/config.module.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('cumple el contrato HealthResponse', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule],
      controllers: [HealthController],
    }).compile();

    const result = moduleRef.get(HealthController).check();

    expect(HealthResponseSchema.safeParse(result).success).toBe(true);
  });
});
