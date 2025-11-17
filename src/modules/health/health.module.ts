import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/**
 * Health check module
 * Provides health monitoring functionality for the application
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}