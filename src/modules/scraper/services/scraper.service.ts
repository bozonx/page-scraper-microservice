import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { BrowserService } from './browser.service.js'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { ScraperRequestDto } from '../dto/scraper-request.dto.js'
import { ScraperResponseDto } from '../dto/scraper-response.dto.js'
import { HtmlRequestDto } from '../dto/html-request.dto.js'
import { HtmlResponseDto } from '../dto/html-response.dto.js'
import { FingerprintService } from './fingerprint.service.js'
import { TurndownConverterService } from './turndown.service.js'
import type { IArticleExtractor } from './article-extractor.interface.js'
import { ConcurrencyService } from './concurrency.service.js'

/**
 * Main scraper service
 * Handles web scraping operations using either Extractor (static content) or Playwright (dynamic content)
 */
@Injectable()
export class ScraperService {
  private readonly maxRetries = 3

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

  /**
   * Scrapes a web page and extracts its content
   * @param request Scraper request parameters
   * @returns Extracted page content
   */
  async scrapePage(request: ScraperRequestDto): Promise<ScraperResponseDto> {
    return this.concurrencyService.run(async () => {
      const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
      const mode = request.mode || scraperConfig.defaultMode

      this.logger.info(`Scraping page: ${request.url} using mode: ${mode}`)

      try {
        let content: any

        // Use appropriate scraping method based on mode
        if (mode === 'playwright') {
          content = await this.scrapeWithPlaywright(request)
        } else {
          // 'extractor' mode (default)
          content = await this.scrapeWithExtractor(request)
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
    })
  }

  /**
   * Scrapes using Extractor for static content
   * @param request Scraper request parameters
   * @returns Extracted content
   */
  private async scrapeWithExtractor(request: ScraperRequestDto): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

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
  private async scrapeWithPlaywright(request: ScraperRequestDto): Promise<any> {
    // Generate fingerprint if enabled
    const fingerprint = this.fingerprintService.generateFingerprint(request.fingerprint)

    // Retry mechanism with fingerprint rotation
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Generate new fingerprint for retry attempts
        const currentFingerprint =
          attempt > 0
            ? this.fingerprintService.generateFingerprint(request.fingerprint)
            : fingerprint

        const result = await this.scrapeWithPlaywrightInternal(request, currentFingerprint)
        return result
      } catch (error) {
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
    fingerprint: any
  ): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const articleExtractor = this.articleExtractor

    return this.browserService.withPage(async (page) => {
      // Determine effective blocking flags from fingerprint configuration
      const effectiveBlockTrackers =
        request.fingerprint?.blockTrackers ?? scraperConfig.playwrightBlockTrackers
      const effectiveBlockHeavy =
        request.fingerprint?.blockHeavyResources ?? scraperConfig.playwrightBlockHeavyResources

      // Block trackers and heavy resources
      if (effectiveBlockTrackers) {
        await page.route(
          '**/*.{css,font,png,jpg,jpeg,gif,svg,webp,ico,woff,woff2}',
          (route) => route.abort()
        )
      }

      if (effectiveBlockHeavy) {
        await page.route('**/*.{mp4,avi,mov,wmv,flv,webm,mp3,wav,ogg}', (route) =>
          route.abort()
        )
      }

      // Navigate to page
      await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
      })

      // Get HTML content
      const html = await page.content()

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
    }, fingerprint)
  }

  /**
   * Retrieves raw HTML content from a web page using Playwright
   * @param request HTML request parameters
   * @returns Raw HTML content
   */
  async getHtml(request: HtmlRequestDto): Promise<HtmlResponseDto> {
    return this.concurrencyService.run(async () => {
      this.logger.info(`Retrieving HTML from: ${request.url}`)

      try {
        // Generate fingerprint if enabled
        const fingerprint = this.fingerprintService.generateFingerprint(request.fingerprint)

        // Retry mechanism with fingerprint rotation
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
          try {
            // Generate new fingerprint for retry attempts
            const currentFingerprint =
              attempt > 0
                ? this.fingerprintService.generateFingerprint(request.fingerprint)
                : fingerprint

            const html = await this.getHtmlWithPlaywright(request, currentFingerprint)
            return {
              url: request.url,
              html,
            }
          } catch (error) {
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

        // This should never be reached due to throw in loop, but TypeScript needs it
        throw new Error('Failed to retrieve HTML after all retry attempts')
      } catch (error) {
        this.logger.error(`Failed to retrieve HTML from ${request.url}:`, error)
        throw error
      }
    })
  }

  /**
   * Internal Playwright HTML retrieval implementation
   * @param request HTML request parameters
   * @param fingerprint Browser fingerprint to use
   * @returns Raw HTML content
   */
  private async getHtmlWithPlaywright(request: HtmlRequestDto, fingerprint: any): Promise<string> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    return this.browserService.withPage(async (page) => {
      // Determine effective blocking flags from fingerprint configuration
      const effectiveBlockTrackers =
        request.fingerprint?.blockTrackers ?? scraperConfig.playwrightBlockTrackers
      const effectiveBlockHeavy =
        request.fingerprint?.blockHeavyResources ?? scraperConfig.playwrightBlockHeavyResources

      // Block trackers and heavy resources
      if (effectiveBlockTrackers) {
        await page.route(
          '**/*.{css,font,png,jpg,jpeg,gif,svg,webp,ico,woff,woff2}',
          (route) => route.abort()
        )
      }

      if (effectiveBlockHeavy) {
        await page.route('**/*.{mp4,avi,mov,wmv,flv,webm,mp3,wav,ogg}', (route) =>
          route.abort()
        )
      }

      // Navigate to page
      await page.goto(request.url, {
        waitUntil: 'networkidle',
        timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
      })

      // Get raw HTML content
      const htmlContent = await page.content()

      if (!htmlContent) {
        throw new Error('HTML retrieval resulted in empty response')
      }

      return htmlContent
    }, fingerprint)
  }
}
