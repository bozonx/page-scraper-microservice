import { Module, Global } from '@nestjs/common';
import { ShutdownService } from './services/shutdown.service.js';
import { ShutdownGuard } from './guards/shutdown.guard.js';

@Global()
@Module({
    providers: [ShutdownService, ShutdownGuard],
    exports: [ShutdownService, ShutdownGuard],
})
export class CommonModule { }
