import { Injectable, CanActivate, ServiceUnavailableException } from '@nestjs/common';
import { ShutdownService } from '../services/shutdown.service.js';

/**
 * Guard that blocks incoming requests during graceful shutdown
 * Returns 503 Service Unavailable if the service is shutting down
 */
@Injectable()
export class ShutdownGuard implements CanActivate {
    constructor(private readonly shutdownService: ShutdownService) { }

    canActivate(): boolean {
        if (this.shutdownService.isShuttingDown()) {
            throw new ServiceUnavailableException('Service is shutting down');
        }
        return true;
    }
}
