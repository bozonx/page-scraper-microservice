import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { FingerprintInjector } from 'fingerprint-injector'
import { ScraperConfig } from '../../../config/scraper.config.js'

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null
  private activePages = 0
  private readonly fingerprintInjector = new FingerprintInjector()

  private parseExtraArgs(value: string | undefined): string[] {
    const raw = (value ?? '').trim()
    if (!raw) return []

    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v)).filter((v) => v.length > 0)
        }
      } catch {
        // ignore
      }
    }

    return raw.split(/\s+/).filter(Boolean)
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(BrowserService.name)
  }

  async onModuleInit() {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    this.logger.info('Launching persistent Playwright browser...')

    try {
      const extraArgs = this.parseExtraArgs(scraperConfig.playwrightExtraArgs)
      this.browser = await chromium.launch({
        headless: scraperConfig.playwrightHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          ...extraArgs,
        ],
      })
      this.logger.info('Browser launched successfully')
    } catch (error) {
      this.logger.error('Failed to launch browser', error)
      if (process.env.NODE_ENV === 'test') {
        return
      }
      throw error
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      // Wait for active pages to close (with timeout)
      if (this.activePages > 0) {
        this.logger.info(`Waiting for ${this.activePages} active pages to close...`)
        const timeout = 5000 // 5 seconds
        const start = Date.now()
        while (this.activePages > 0 && Date.now() - start < timeout) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        if (this.activePages > 0) {
          this.logger.warn(`${this.activePages} pages still active, forcing browser close`)
        }
      }

      this.logger.info('Closing persistent Playwright browser...')
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Executes a callback with a new page in a fresh context
   * @param callback Function to execute with the page
   * @param fingerprint Optional fingerprint to inject
   */
  async withPage<T>(
    callback: (page: Page) => Promise<T>,
    fingerprint?: any,
    signal?: AbortSignal,
    opts?: {
      timezoneId?: string
      locale?: string
    }
  ): Promise<T> {
    if (!this.browser) {
      this.logger.error('Browser not initialized')
      throw new Error('Browser not initialized')
    }

    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const navigationTimeoutMs = Math.max(1, scraperConfig.playwrightNavigationTimeoutSecs) * 1000

    if (signal?.aborted) {
      throw new Error('Request aborted')
    }

    let context: BrowserContext | null = null
    let page: Page | null = null

    this.activePages++

    // Setup abort handler
    const onAbort = async () => {
      if (page) {
        this.logger.warn('Request aborted, closing page...')
        await page.close().catch(() => {})
      }
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      // Create new isolated context
      context = await this.browser.newContext({
        viewport: fingerprint?.fingerprint?.screen
          ? {
              width: fingerprint.fingerprint.screen.width,
              height: fingerprint.fingerprint.screen.height,
            }
          : undefined,
        userAgent: fingerprint?.fingerprint?.navigator?.userAgent,
        locale: opts?.locale ?? fingerprint?.fingerprint?.navigator?.language,
        timezoneId: opts?.timezoneId,
      })

      context.setDefaultNavigationTimeout(navigationTimeoutMs)
      context.setDefaultTimeout(navigationTimeoutMs)

      // Inject fingerprint if provided
      if (fingerprint && fingerprint.fingerprint) {
        try {
          await this.fingerprintInjector.attachFingerprintToPlaywright(context, fingerprint)
        } catch (error) {
          this.logger.warn('Failed to attach fingerprint', error)
        }
      }

      page = await context.newPage()

      page.setDefaultNavigationTimeout(navigationTimeoutMs)
      page.setDefaultTimeout(navigationTimeoutMs)

      // Check again if aborted during setup
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }

      return await callback(page)
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }
      if (error instanceof Error) {
        this.logger.error(
          {
            errName: error.name,
            errMessage: error.message,
            errStack: error.stack,
          },
          'Error in withPage'
        )
      } else {
        this.logger.error({ err: error }, 'Error in withPage')
      }
      throw error
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
      this.activePages--
      if (page) {
        await page.close().catch(() => {})
      }
      if (context) {
        await context.close().catch(() => {})
      }
    }
  }
}
