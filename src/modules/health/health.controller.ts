import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp?: string;
  uptime?: number;
}

/**
 * Simple health check controller
 * Provides a minimal `/health` endpoint
 */
@Controller('health')
export class HealthController {
  /**
   * Basic health check endpoint returning a simple OK status
   */
  @Get()
  public check(): HealthResponse {
    return { status: 'ok' };
  }
}
