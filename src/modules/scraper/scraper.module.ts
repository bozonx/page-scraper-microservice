import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller'
import { ScraperService } from './services/scraper.service'
import { BatchService } from './services/batch.service'
import { WebhookService } from './services/webhook.service'
import { FingerprintService } from './services/fingerprint.service'

@Module({
  controllers: [ScraperController],
  providers: [ScraperService, BatchService, WebhookService, FingerprintService],
  exports: [ScraperService, BatchService, WebhookService, FingerprintService],
})
export class ScraperModule {}
