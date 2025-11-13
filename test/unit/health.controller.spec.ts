import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '@/modules/health/health.controller';

describe('HealthController (unit)', () => {
  let controller: HealthController;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /api/v1/health returns ok', async () => {
    const res = await controller.check();
    expect(res).toEqual({ status: 'ok' });
  });
});
