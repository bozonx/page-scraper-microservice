import { Module } from '@nestjs/common'
import { ScraperController } from './scraper.controller.js'
import { ScraperService } from './services/scraper.service.js'
import { FingerprintService } from './services/fingerprint.service.js'
import { TurndownConverterService } from './services/turndown.service.js'
import { ArticleExtractorService } from './services/article-extractor.service.js'
import { ConcurrencyService } from './services/concurrency.service.js'
import { BrowserService } from './services/browser.service.js'
import { FetchService } from './services/fetch.service.js'
import { FileService } from './services/file.service.js'

/**
 * Scraper module
 * Provides web scraping functionality with support for both static (Extractor) and dynamic (Playwright) content
 * Includes browser fingerprinting capabilities
 */
@Module({
  controllers: [ScraperController],
  providers: [
    ScraperService,
    FingerprintService,
    TurndownConverterService,
    ConcurrencyService,
    BrowserService,
    FetchService,
    FileService,
    {
      // Provide article extractor as an interface for better testability
      provide: 'IArticleExtractor',
      useClass: ArticleExtractorService,
    },
  ],
  exports: [
    ScraperService,
    FingerprintService,
    TurndownConverterService,
    ConcurrencyService,
    BrowserService,
    FetchService,
    FileService,
    'IArticleExtractor',
  ],
})
export class ScraperModule {}
