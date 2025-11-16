import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { PlaywrightCrawler } from 'crawlee'
import { ScraperConfig } from '@config/scraper.config'
import { ScraperRequestDto } from '../dto/scraper-request.dto'
import { ScraperResponseDto } from '../dto/scraper-response.dto'
import { FingerprintService } from './fingerprint.service'
import { TurndownConverterService } from './turndown.service'
import { IArticleExtractor } from './article-extractor.interface'

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

  async scrapePage(request: ScraperRequestDto): Promise<ScraperResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const mode = request.mode || scraperConfig.defaultMode

    this.logger.info(`Scraping page: ${request.url} using mode: ${mode}`)

    try {
      let content: any

      if (mode === 'playwright') {
        content = await this.scrapeWithPlaywright(request)
      } else {
        content = await this.scrapeWithCheerio(request)
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

  private async scrapeWithCheerio(request: ScraperRequestDto): Promise<any> {
    return await this.articleExtractor.extract(request.url)
  }

  private async scrapeWithPlaywright(request: ScraperRequestDto): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Generate fingerprint if enabled
    const fingerprint = this.fingerprintService.generateFingerprint(request.fingerprint)

    // Retry mechanism with fingerprint rotation
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
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

        // If it's the last attempt or no anti-bot detected, throw the error
        throw error
      }
    }
  }

  private async scrapeWithPlaywrightInternal(
    request: ScraperRequestDto,
    fingerprint: any
  ): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const articleExtractor = this.articleExtractor // Store reference to use inside callback

    let extracted: any | undefined
    let runError: Error | null = null

    const crawler = new PlaywrightCrawler({
      launchContext: {
        launchOptions: {
          timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
          headless: scraperConfig.playwrightHeadless,
        },
      },
      requestHandlerTimeoutSecs: request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs,
      navigationTimeoutSecs: scraperConfig.playwrightNavigationTimeoutSecs,

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

          // Block trackers and heavy resources if requested
          if (request.blockTrackers !== false && scraperConfig.playwrightBlockTrackers) {
            await page.route(
              '**/*.{css,font,png,jpg,jpeg,gif,svg,webp,ico,woff,woff2}',
              (route) => route.abort()
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

          // Navigate to the page
          await page.goto(request.url, {
            waitUntil: 'networkidle',
            timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
          })

          // Get the HTML content
          const html = await page.content()

          // Extract content using article extractor
          extracted = await articleExtractor.extractFromHtml(html)
        } catch (error) {
          runError = error instanceof Error ? error : new Error(String(error))
        }
      },

      failedRequestHandler({ request: req, error }) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        runError = new Error(`Failed to load ${req.url}: ${errorMessage}`)
      },
    })

    // Add request to the queue
    crawler.addRequests([request.url])

    // Start the crawler
    await crawler.run()

    if (runError) throw runError
    if (typeof extracted === 'undefined') {
      throw new Error('Content extraction resulted in empty response')
    }
    return extracted
  }
}
