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
            this.browser = await chromium.launch({
                headless: scraperConfig.playwrightHeadless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            })
            this.logger.info('Browser launched successfully')
        } catch (error) {
            this.logger.error('Failed to launch browser', error)
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
                    await new Promise(resolve => setTimeout(resolve, 100))
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
        fingerprint?: any
    ): Promise<T> {
        if (!this.browser) {
            this.logger.error('Browser not initialized')
            throw new Error('Browser not initialized')
        }

        let context: BrowserContext | null = null
        let page: Page | null = null

        this.activePages++
        try {
            // Create new isolated context
            context = await this.browser.newContext({
                viewport: fingerprint?.fingerprint?.screen ? {
                    width: fingerprint.fingerprint.screen.width,
                    height: fingerprint.fingerprint.screen.height
                } : undefined,
                userAgent: fingerprint?.fingerprint?.navigator?.userAgent,
                locale: fingerprint?.fingerprint?.navigator?.language,
            })

            // Inject fingerprint if provided
            if (fingerprint && fingerprint.fingerprint) {
                try {
                    await this.fingerprintInjector.attachFingerprintToPlaywright(context, fingerprint)
                } catch (error) {
                    this.logger.warn('Failed to attach fingerprint', error)
                }
            }

            page = await context.newPage()
            return await callback(page)
        } catch (error) {
            this.logger.error('Error in withPage', error)
            throw error
        } finally {
            this.activePages--
            if (page) {
                await page.close().catch(() => { })
            }
            if (context) {
                await context.close().catch(() => { })
            }
        }
    }
}
