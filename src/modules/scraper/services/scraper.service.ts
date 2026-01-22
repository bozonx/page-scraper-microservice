import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { BrowserService } from './browser.service.js'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { ScraperRequestDto } from '../dto/scraper-request.dto.js'
import { ScraperResponseDto } from '../dto/scraper-response.dto.js'
import { FingerprintService } from './fingerprint.service.js'
import { TurndownConverterService } from './turndown.service.js'
import type { IArticleExtractor } from './article-extractor.interface.js'
import { ConcurrencyService } from './concurrency.service.js'
import type { PlaywrightBlocker } from '@ghostery/adblocker-playwright'

/**
 * Main scraper service
 * Handles web scraping operations using either Extractor (static content) or Playwright (dynamic content)
 */
@Injectable()
export class ScraperService {
  private readonly maxRetries = 3
  private trackerBlockerPromise: Promise<PlaywrightBlocker> | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly fingerprintService: FingerprintService,
    private readonly logger: PinoLogger,
    private readonly turndownConverterService: TurndownConverterService,
    @Inject('IArticleExtractor') private readonly articleExtractor: IArticleExtractor,
    private readonly concurrencyService: ConcurrencyService,
    private readonly browserService: BrowserService
  ) {
    this.logger.setContext(ScraperService.name)
  }

  private getTrackerBlocker(): Promise<PlaywrightBlocker> {
    if (!this.trackerBlockerPromise) {
      this.trackerBlockerPromise = (async () => {
        const mod = await import('@ghostery/adblocker-playwright')
        return mod.PlaywrightBlocker.fromPrebuiltAdsAndTracking(
          globalThis.fetch as unknown as typeof fetch
        )
      })()
    }
    return this.trackerBlockerPromise
  }

  /**
   * Scrapes a web page and extracts its content
   * @param request Scraper request parameters
   * @returns Extracted page content
   */
  async scrapePage(request: ScraperRequestDto, signal?: AbortSignal): Promise<ScraperResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const mode = request.mode || scraperConfig.defaultMode

    const run =
      mode === 'playwright'
        ? this.concurrencyService.runBrowser.bind(this.concurrencyService)
        : this.concurrencyService.run.bind(this.concurrencyService)

    return run(async () => {
      this.logger.info(`Scraping page: ${request.url} using mode: ${mode}`)

      try {
        let content: any

        // Use appropriate scraping method based on mode
        if (mode === 'playwright') {
          content = await this.scrapeWithPlaywright(request, signal)
        } else {
          // 'extractor' mode (default)
          content = await this.scrapeWithExtractor(request, signal)
        }

        // Prepare body based on rawBody flag: either raw extractor output or Markdown
        const rawHtml = content?.content ?? ''
        const shouldReturnRaw = request.rawBody === true
        const body = shouldReturnRaw
          ? rawHtml
          : rawHtml
            ? this.turndownConverterService.convertToMarkdown(rawHtml)
            : ''

        // Calculate read time (200 wpm). Empty body => 0
        const trimmed = body.trim()
        const wordCount = trimmed.length ? trimmed.split(/\s+/).length : 0
        const readTimeMin = wordCount === 0 ? 0 : Math.ceil(wordCount / 200)

        return {
          url: request.url,
          title: content?.title,
          description: content?.description,
          date: (content as any)?.published ?? (content as any)?.publishedTime,
          author: content?.author,
          image: (content as any)?.image,
          favicon: (content as any)?.favicon,
          type: (content as any)?.type,
          source: (content as any)?.source,
          links: (content as any)?.links,
          ttr: (content as any)?.ttr,
          body,
          meta: {
            lang: content?.lang,
            readTimeMin,
            rawBody: shouldReturnRaw,
          },
        }
      } catch (error) {
        this.logger.error(`Failed to scrape page ${request.url}:`, error)
        throw error
      }
    }, signal)
  }

  /**
   * Scrapes using Extractor for static content
   * @param request Scraper request parameters
   * @returns Extracted content
   */
  private async scrapeWithExtractor(
    request: ScraperRequestDto,
    signal?: AbortSignal
  ): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    if (signal?.aborted) throw new Error('Request aborted')

    // Simulate fingerprint via headers when possible
    const fp = this.fingerprintService.generateFingerprint(request.fingerprint)
    const headers: Record<string, string> = {}

    // Apply generated headers (User-Agent, Accept-Language, etc.)
    if (fp.headers?.['Accept-Language']) {
      headers['Accept-Language'] = fp.headers['Accept-Language']
    }
    if (fp.headers?.['User-Agent']) {
      headers['User-Agent'] = fp.headers['User-Agent']
    }

    return await this.articleExtractor.extract(request.url, { headers })
  }

  /**
   * Scrapes using Playwright for dynamic content with retry logic
   * @param request Scraper request parameters
   * @returns Extracted content
   */
  private async scrapeWithPlaywright(
    request: ScraperRequestDto,
    signal?: AbortSignal
  ): Promise<any> {
    // Generate fingerprint if enabled
    const fingerprint = this.fingerprintService.generateFingerprint(request.fingerprint)

    // Retry mechanism with fingerprint rotation
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      if (signal?.aborted) throw new Error('Request aborted')
      try {
        // Generate new fingerprint for retry attempts
        const currentFingerprint =
          attempt > 0
            ? this.fingerprintService.generateFingerprint(request.fingerprint)
            : fingerprint

        const result = await this.scrapeWithPlaywrightInternal(request, currentFingerprint, signal)
        return result
      } catch (error) {
        if (signal?.aborted) throw new Error('Request aborted')
        // Check if we should rotate fingerprint and retry
        if (
          this.fingerprintService.shouldRotateFingerprint(error, request.fingerprint) &&
          attempt < this.maxRetries - 1
        ) {
          this.logger.warn(
            `Anti-bot detected for ${request.url}, rotating fingerprint and retrying (attempt ${attempt + 1}/${this.maxRetries})`
          )
          continue
        }

        // If it's last attempt or no anti-bot detected, throw error
        throw error
      }
    }
  }

  /**
   * Internal Playwright scraping implementation
   * @param request Scraper request parameters
   * @param fingerprint Browser fingerprint to use
   * @returns Extracted content
   */
  private async scrapeWithPlaywrightInternal(
    request: ScraperRequestDto,
    fingerprint: any,
    signal?: AbortSignal
  ): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const articleExtractor = this.articleExtractor

    const taskTimeoutMs = (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000
    const navigationTimeoutMs = Math.max(1, scraperConfig.playwrightNavigationTimeoutSecs) * 1000
    const gotoTimeoutMs = Math.min(taskTimeoutMs, navigationTimeoutMs)

    return this.browserService.withPage(
      async (page) => {
        // Determine effective blocking flags from fingerprint configuration
        const effectiveBlockTrackers =
          request.fingerprint?.blockTrackers ?? scraperConfig.playwrightBlockTrackers
        const effectiveBlockHeavy =
          request.fingerprint?.blockHeavyResources ?? scraperConfig.playwrightBlockHeavyResources

        if (effectiveBlockTrackers) {
          const blocker = await this.getTrackerBlocker()
          await blocker.enableBlockingInPage(page)
        }

        if (effectiveBlockHeavy) {
          await page.route('**/*.{css,font,png,jpg,jpeg,gif,svg,webp,ico,woff,woff2}', (route) =>
            route.abort()
          )
          await page.route('**/*.{mp4,avi,mov,wmv,flv,webm,mp3,wav,ogg}', (route) => route.abort())
        }

        // Navigate to page
        await page.goto(request.url, {
          waitUntil: 'domcontentloaded',
          timeout: gotoTimeoutMs,
        })

        // Get HTML content
        const html = await page.content()

        const maxHtmlBytes = Math.max(1, scraperConfig?.fetchMaxResponseBytes ?? 10 * 1024 * 1024)
        if (Buffer.byteLength(html, 'utf-8') > maxHtmlBytes) {
          throw new Error('Response too large')
        }

        // Extract content using article extractor with same header hints
        const headers: Record<string, string> = {}
        if (fingerprint.headers?.['Accept-Language'])
          headers['Accept-Language'] = fingerprint.headers['Accept-Language']
        if (fingerprint.headers?.['User-Agent'])
          headers['User-Agent'] = fingerprint.headers['User-Agent']

        const extracted = await articleExtractor.extractFromHtml(html, request.url, { headers })

        if (!extracted) {
          throw new Error('Content extraction resulted in empty response')
        }

        return extracted
      },
      fingerprint,
      signal
    )
  }
}
