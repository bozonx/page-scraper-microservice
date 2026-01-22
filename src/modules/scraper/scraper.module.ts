import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller.js'
import { ScraperService } from './services/scraper.service.js'
import { BatchService } from './services/batch.service.js'
import { WebhookService } from './services/webhook.service.js'
import { FingerprintService } from './services/fingerprint.service.js'
import { TurndownConverterService } from './services/turndown.service.js'
import { ArticleExtractorService } from './services/article-extractor.service.js'
import { CleanupService } from './services/cleanup.service.js'
import { MemoryStoreService } from './services/memory-store.service.js'
import { ConcurrencyService } from './services/concurrency.service.js'
import { BrowserService } from './services/browser.service.js'
import { FetchService } from './services/fetch.service.js'

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
    CleanupService,
    MemoryStoreService,
    ConcurrencyService,
    BrowserService,
    FetchService,
    {
      // Provide article extractor as an interface for better testability
      provide: 'IArticleExtractor',
      useClass: ArticleExtractorService,
    },
  ],
  exports: [
    ScraperService,
    BatchService,
    WebhookService,
    FingerprintService,
    TurndownConverterService,
    CleanupService,
    MemoryStoreService,
    ConcurrencyService,
    BrowserService,
    FetchService,
    'IArticleExtractor',
  ],
})
export class ScraperModule {}
