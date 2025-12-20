import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ShutdownService {
    private shuttingDown = false;
    private activeRequests = 0;

    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(ShutdownService.name);
    }

    isShuttingDown(): boolean {
        return this.shuttingDown;
    }

    markShuttingDown(): void {
        if (!this.shuttingDown) {
            this.logger.warn(`Graceful shutdown initiated. Active requests: ${this.activeRequests}`);
            this.shuttingDown = true;
        }
    }

    incrementActiveRequests(): void {
        if (!this.shuttingDown) {
            this.activeRequests++;
        }
    }

    decrementActiveRequests(): void {
        this.activeRequests--;
        if (this.activeRequests < 0) {
            this.activeRequests = 0;
        }
    }

    getActiveRequests(): number {
        return this.activeRequests;
    }
}
