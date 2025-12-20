import { Test, TestingModule } from '@nestjs/testing'
import { HealthController } from '@/modules/health/health.controller.js'
import { ShutdownService } from '@/common/services/shutdown.service.js'

describe('HealthController (unit)', () => {
  let controller: HealthController
  let moduleRef: TestingModule
  let shutdownService: ShutdownService

  const mockShutdownService = {
    isShuttingDown: jest.fn().mockReturnValue(false),
    getActiveRequests: jest.fn().mockReturnValue(0),
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ShutdownService,
          useValue: mockShutdownService,
        },
      ],
    }).compile()

    controller = moduleRef.get<HealthController>(HealthController)
    shutdownService = moduleRef.get<ShutdownService>(ShutdownService)
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('GET /api/v1/health returns ok when not shutting down', async () => {
    mockShutdownService.isShuttingDown.mockReturnValue(false)

    const mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }

    await controller.check(mockReply as any)

    expect(mockReply.status).toHaveBeenCalledWith(200)
    expect(mockReply.send).toHaveBeenCalledWith({ status: 'ok' })
  })

  it('GET /api/v1/health returns 503 when shutting down', async () => {
    mockShutdownService.isShuttingDown.mockReturnValue(true)
    mockShutdownService.getActiveRequests.mockReturnValue(5)

    const mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }

    await controller.check(mockReply as any)

    expect(mockReply.status).toHaveBeenCalledWith(503)
    expect(mockReply.send).toHaveBeenCalledWith({
      status: 'shutting_down',
      activeRequests: 5,
      timestamp: expect.any(String)
    })
  })
})
