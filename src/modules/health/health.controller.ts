import { Controller, Get } from '@nestjs/common';

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
  public check() {
    return { status: 'ok' };
  }
}
