import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller'
import { ScraperService } from './services/scraper.service'
import { BatchService } from './services/batch.service'
import { WebhookService } from './services/webhook.service'

@Module({
  controllers: [ScraperController],
  providers: [ScraperService, BatchService, WebhookService],
  exports: [ScraperService, BatchService, WebhookService],
})
export class ScraperModule {}
