import { Controller, Get, Res, HttpStatus } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { ShutdownService } from '../../common/services/shutdown.service.js'
import { Public } from '../../common/decorators/public.decorator.js'
import { SERVICE_NAME, SERVICE_VERSION } from '../../config/service-info.js'

/**
 * Health check response interface
 * Defines the structure of health check responses
 */
export interface HealthResponse {
  status: 'ok' | 'shutting_down'
  service: string
  version: string
  uptimeSec: number
}

/**
 * Simple health check controller
 * Provides a minimal `/health` endpoint for monitoring service status
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now()

  constructor(private readonly shutdownService: ShutdownService) {}

  /**
   * Basic health check endpoint returning a simple OK status
   * @returns Health response indicating service is operational
   */
  @Public()
  @Get()
  public check(@Res() res: FastifyReply) {
    const shuttingDown = this.shutdownService.isShuttingDown()
    const body: HealthResponse = {
      status: shuttingDown ? 'shutting_down' : 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
    }
    return res.status(shuttingDown ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK).send(body)
  }
}
