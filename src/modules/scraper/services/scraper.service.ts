import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PlaywrightCrawler } from 'crawlee'
import TurndownService from 'turndown'
import { ScraperConfig } from '@config/scraper.config'
import { ScraperRequestDto } from '../dto/scraper-request.dto'
import { ScraperResponseDto } from '../dto/scraper-response.dto'

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name)
  private readonly turndownService: TurndownService

  constructor(private readonly configService: ConfigService) {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
    })
  }

  async scrapePage(request: ScraperRequestDto): Promise<ScraperResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const mode = request.mode || scraperConfig.defaultMode

    this.logger.log(`Scraping page: ${request.url} using mode: ${mode}`)

    try {
      let content: any

      if (mode === 'playwright') {
        content = await this.scrapeWithPlaywright(request)
      } else {
        content = await this.scrapeWithCheerio(request)
      }

      // Convert HTML to Markdown
      const body = content.content ? this.turndownService.turndown(content.content) : ''

      // Calculate read time (rough estimate: 200 words per minute)
      const wordCount = body.split(/\s+/).length
      const readTimeMin = Math.ceil(wordCount / 200)

      return {
        url: request.url,
        title: content.title,
        description: content.description,
        date: content.publishedTime,
        author: content.author,
        body,
        meta: {
          lang: content.lang,
          readTimeMin,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to scrape page ${request.url}:`, error)
      throw error
    }
  }

  private async scrapeWithCheerio(request: ScraperRequestDto): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Dynamic import for ESM module
    const { extract } = await import('@extractus/article-extractor')
    return await extract(request.url)
  }

  private async scrapeWithPlaywright(request: ScraperRequestDto): Promise<any> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!;
    
    // Generate fingerprint if enabled
    const fingerprint = this.fingerprintService.generateFingerprint(request.fingerprint);
    
    return new Promise(async (resolve, reject) => {
      const crawler = new PlaywrightCrawler({
        headless: scraperConfig.playwrightHeadless,
        launchContext: {
          launchOptions: {
            timeout: (request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs) * 1000,
            // Apply fingerprint to browser launch
            ...(fingerprint.userAgent && { userAgent: fingerprint.userAgent }),
            ...(fingerprint.viewport && {
              defaultViewport: {
                width: fingerprint.viewport.width,
                height: fingerprint.viewport.height
              }
            }),
          },
        },
        requestHandlerTimeoutSecs: request.taskTimeoutSecs || scraperConfig.defaultTaskTimeoutSecs,
        navigationTimeoutSecs: scraperConfig.playwrightNavigationTimeoutSecs,

        async requestHandler({ page }) {
          try {
            // Apply fingerprint to page context
            if (fingerprint.userAgent) {
              await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'userAgent', {
                  value: fingerprint.userAgent,
                  writable: false,
                });
              });
            }
            
            if (fingerprint.viewport) {
              await page.setViewportSize({
                width: fingerprint.viewport.width,
                height: fingerprint.viewport.height,
              });
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
            const { extract } = await import('@extractus/article-extractor')
            const content = await extract(html)

            resolve(content)
          } catch (error) {
            reject(error)
          }
        },

        failedRequestHandler({ request, error }) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          // Check if we should rotate fingerprint and retry
          if (this.fingerprintService.shouldRotateFingerprint(error, request.fingerprint)) {
            this.logger.warn(`Anti-bot detected for ${request.url}, would rotate fingerprint and retry`);
            // For now, we'll just reject. In a full implementation,
            // we would retry with a new fingerprint
            reject(new Error(`Failed to load ${request.url}: ${errorMessage} (anti-bot detected)`))
          } else {
            reject(new Error(`Failed to load ${request.url}: ${errorMessage}`))
          }
        },
      })

      // Add request to the queue
      crawler.addRequests([request.url])

      // Start the crawler
      try {
        await crawler.run()
      } catch (error) {
        reject(error)
      }
    })
  }
}
