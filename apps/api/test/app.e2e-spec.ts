import { Controller, Get, INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ApiErrorResponseSchema, HealthResponseSchema } from '@rulet/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { RequireFeature } from '../src/common/guards/feature.guard';

@Controller('admin-probe')
@RequireFeature('adminPanel')
class AdminProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminProbeController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    setupApp(app as NestExpressApplication);
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /health responde según el contrato y con request id', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('las rutas de dominio están versionadas en /v1', async () => {
    await request(app.getHttpServer()).get('/v1/admin-probe').set('x-client-platform', 'web').expect(200);
  });

  it('bloquea funcionalidades no disponibles en la plataforma', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin-probe')
      .set('x-client-platform', 'mobile')
      .expect(403);
    expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('los errores 404 usan el formato común', async () => {
    const res = await request(app.getHttpServer()).get('/v1/no-existe').expect(404);
    expect(ApiErrorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});
