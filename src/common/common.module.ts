import { Module, Global } from '@nestjs/common';
import { ShutdownService } from './services/shutdown.service.js';

@Global()
@Module({
    providers: [ShutdownService],
    exports: [ShutdownService],
})
export class CommonModule { }
