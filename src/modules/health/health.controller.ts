import { Controller, Get, Res, HttpStatus } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { ShutdownService } from '../../common/services/shutdown.service.js'

/**
 * Health check response interface
 * Defines the structure of health check responses
 */
export interface HealthResponse {
  status: 'ok' | 'error' | 'shutting_down'
  timestamp?: string
  uptime?: number
  activeRequests?: number
}

/**
 * Simple health check controller
 * Provides a minimal `/health` endpoint for monitoring service status
 */
@Controller('health')
export class HealthController {
  constructor(private readonly shutdownService: ShutdownService) { }

  /**
   * Basic health check endpoint returning a simple OK status
   * @returns Health response indicating service is operational
   */
  @Get()
  public check(@Res() res: FastifyReply) {
    if (this.shutdownService.isShuttingDown()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).send({
        status: 'shutting_down',
        activeRequests: this.shutdownService.getActiveRequests(),
        timestamp: new Date().toISOString()
      })
    }
    return res.status(HttpStatus.OK).send({ status: 'ok' })
  }
}
