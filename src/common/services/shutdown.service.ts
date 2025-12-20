import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ShutdownService {
    private shuttingDown = false;

    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(ShutdownService.name);
    }

    isShuttingDown(): boolean {
        return this.shuttingDown;
    }

    markShuttingDown(): void {
        if (!this.shuttingDown) {
            this.logger.warn('Graceful shutdown initiated');
            this.shuttingDown = true;
        }
    }
}
