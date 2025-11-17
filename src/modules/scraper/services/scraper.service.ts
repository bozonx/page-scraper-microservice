import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { PlaywrightCrawler } from 'crawlee'
import { ScraperConfig } from '@config/scraper.config'
import { ScraperRequestDto } from '../dto/scraper-request.dto'
import { ScraperResponseDto } from '../dto/scraper-response.dto'
import { FingerprintService } from './fingerprint.service'
import { TurndownConverterService } from './turndown.service'
import type { IArticleExtractor } from './article-extractor.interface'

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
    @Inject('IArticleExtractor') private readonly articleExtractor: IArticleExtractor
  ) {
    this.logger.setContext(ScraperService.name)
  }

  /**
   * Scrapes a web page and extracts its content
   * @param request Scraper request parameters
   * @returns Extracted page content
   */
  async scrapePage(request: ScraperRequestDto): Promise<ScraperResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const mode = request.mode || scraperConfig.defaultMode

    this.logger.info(`Scraping page: ${request.url} using mode: ${mode}`)

    try {
      let content: any
      const effectiveTimeoutSecs = request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs

      // Use appropriate scraping method based on mode
      if (mode === 'playwright') {
        content = await this.withTimeout(
          effectiveTimeoutSecs * 1000,
          this.scrapeWithPlaywright(request)
        )
      } else {
        // 'extractor' mode (default)
        content = await this.withTimeout(
          effectiveTimeoutSecs * 1000,
          this.scrapeWithExtractor(request)
        )
      }

      // Convert HTML to Markdown
      const rawHtml = content?.content ?? ''
      const body = rawHtml ? this.turndownConverterService.convertToMarkdown(rawHtml) : ''

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
        body,
        meta: {
          lang: content?.lang,
          readTimeMin,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to scrape page ${request.url}:`, error)
      throw error
    }
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

    if (request.locale || scraperConfig.defaultLocale) {
      headers['Accept-Language'] = (request.locale || scraperConfig.defaultLocale) as string
    }
    if (fp.userAgent) {
      headers['User-Agent'] = fp.userAgent
    }
    // Provide timezone hint for downstream parsing/heuristics
    if (request.timezoneId || scraperConfig.defaultTimezoneId) {
      headers['X-Timezone-Id'] = (request.timezoneId || scraperConfig.defaultTimezoneId) as string
    }

    return await this.articleExtractor.extract(request.url, { headers })
  }

  /**
   * Scrapes using Playwright for dynamic content with retry logic
   * @param request Scraper request parameters
   * @returns Extracted content
   */
  private async scrapeWithPlaywright(request: ScraperRequestDto): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

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
        const errorMessage = error instanceof Error ? error.message : String(error)

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
    const articleExtractor = this.articleExtractor // Store reference to use inside callback

    let extracted: any | undefined
    let runError: Error | null = null

    // Configure Playwright crawler
    const tzForContext = request.timezoneId || scraperConfig.defaultTimezoneId
    const localeForContext = request.locale || scraperConfig.defaultLocale

    const launchContext: any = {
      launchOptions: {
        timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
        headless: scraperConfig.playwrightHeadless,
      },
      // Apply per-context options so all pages use the desired timezone/locale
      contextOptions: {
        ...(tzForContext ? { timezoneId: tzForContext } : {}),
        ...(localeForContext ? { locale: localeForContext as string } : {}),
      },
    }

    const crawler = new PlaywrightCrawler({
      launchContext,
      requestHandlerTimeoutSecs: request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs,
      navigationTimeoutSecs: request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs,

      async requestHandler({ page }) {
        try {
          // Apply fingerprint to page context
          if (fingerprint.userAgent) {
            await page.addInitScript((ua) => {
              Object.defineProperty(navigator, 'userAgent', {
                value: ua,
                writable: false,
              })
            }, fingerprint.userAgent)
          }

          if (fingerprint.viewport) {
            await page.setViewportSize({
              width: fingerprint.viewport.width,
              height: fingerprint.viewport.height,
            })
          }

          // Timezone is set via contextOptions.timezoneId at context creation time

          // Block trackers and heavy resources if requested
          if (request.blockTrackers !== false && scraperConfig.playwrightBlockTrackers) {
            await page.route('**/*.{css,font,png,jpg,jpeg,gif,svg,webp,ico,woff,woff2}', (route) =>
              route.abort()
            )
          }

          if (
            request.blockHeavyResources !== false &&
            scraperConfig.playwrightBlockHeavyResources
          ) {
            await page.route('**/*.{mp4,avi,mov,wmv,flv,webm,mp3,wav,ogg}', (route) =>
              route.abort()
            )
          }

          // Navigate to page
          await page.goto(request.url, {
            waitUntil: 'networkidle',
          })

          // Get HTML content
          const html = await page.content()

          // Extract content using article extractor with same header hints
          const headers: Record<string, string> = {}
          if (fingerprint.language) headers['Accept-Language'] = fingerprint.language
          if (fingerprint.userAgent) headers['User-Agent'] = fingerprint.userAgent
          if (tzForContext) headers['X-Timezone-Id'] = tzForContext as string
          extracted = await articleExtractor.extractFromHtml(html, { headers })
        } catch (error) {
          runError = error instanceof Error ? error : new Error(String(error))
        }
      },

      failedRequestHandler({ request: req, error }) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        runError = new Error(`Failed to load ${req.url}: ${errorMessage}`)
      },
    })

    // Add request to queue and start crawling
    crawler.addRequests([request.url])
    await crawler.run()

    if (runError) throw runError
    if (typeof extracted === 'undefined') {
      throw new Error('Content extraction resulted in empty response')
    }
    return extracted
  }

  private async withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Task timed out')), ms)
      promise
        .then((res) => {
          clearTimeout(timer)
          resolve(res)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}
