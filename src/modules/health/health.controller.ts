import { Controller, Get } from '@nestjs/common'

/**
 * Health check response interface
 * Defines the structure of health check responses
 */
export interface HealthResponse {
  status: 'ok' | 'error'
  timestamp?: string
  uptime?: number
}

/**
 * Simple health check controller
 * Provides a minimal `/health` endpoint for monitoring service status
 */
@Controller('health')
export class HealthController {
  /**
   * Basic health check endpoint returning a simple OK status
   * @returns Health response indicating service is operational
   */
  @Get()
  public check(): HealthResponse {
    return { status: 'ok' }
  }
}
