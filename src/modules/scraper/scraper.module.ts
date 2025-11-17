import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller'
import { ScraperService } from './services/scraper.service'
import { BatchService } from './services/batch.service'
import { WebhookService } from './services/webhook.service'
import { FingerprintService } from './services/fingerprint.service'
import { TurndownConverterService } from './services/turndown.service'
import { ArticleExtractorService } from './services/article-extractor.service'

/**
 * Scraper module
 * Provides web scraping functionality with support for both static (Extractor) and dynamic (Playwright) content
 * Includes batch processing, webhooks, and browser fingerprinting capabilities
 */
@Module({
  controllers: [ScraperController],
  providers: [
    ScraperService,
    BatchService,
    WebhookService,
    FingerprintService,
    TurndownConverterService,
    {
      // Provide article extractor as an interface for better testability
      provide: 'IArticleExtractor',
      useClass: ArticleExtractorService
    }
  ],
  exports: [
    ScraperService,
    BatchService,
    WebhookService,
    FingerprintService,
    TurndownConverterService,
    'IArticleExtractor'
  ],
})
export class ScraperModule {}