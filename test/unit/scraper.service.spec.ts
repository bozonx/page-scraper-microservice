import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from '@/modules/scraper/services/scraper.service.js'
import { BrowserService } from '@/modules/scraper/services/browser.service.js'
import { FingerprintService } from '@/modules/scraper/services/fingerprint.service.js'
import { TurndownConverterService } from '@/modules/scraper/services/turndown.service.js'
import type { ScraperRequestDto } from '@/modules/scraper/dto/scraper-request.dto.js'
import type { ScraperConfig } from '@/config/scraper.config.js'
import {
  createMockLogger,
  createMockConfigService,
  createMockTurndownConverterService,
  createMockArticleExtractor,
} from '@test/helpers/mocks.js'
import { ConcurrencyService } from '@/modules/scraper/services/concurrency.service.js'

describe('ScraperService (unit)', () => {
  let moduleRef: TestingModule
  let service: ScraperService

  // Shared mocks
  const logger = createMockLogger()
  const articleExtractor = createMockArticleExtractor()
  const fingerprintService: Partial<FingerprintService> = {
    generateFingerprint: jest.fn(
      () =>
        ({
          fingerprint: {
            navigator: {
              userAgent: 'UA',
              language: 'en-US',
            },
            screen: { width: 1920, height: 1080 },
          },
          headers: {
            'User-Agent': 'UA',
            'Accept-Language': 'en-US',
          },
          timezone: 'UTC',
        }) as any
    ),
    shouldRotateFingerprint: jest.fn(() => false),
  }

  const browserService = {
    withPage: jest.fn(async (callback) => {
      const page = {
        route: jest.fn(),
        goto: jest.fn(),
        content: jest.fn().mockResolvedValue('<html><body><h1>Hello</h1></body></html>'),
        close: jest.fn(),
      }
      const result = await callback(page)
      ;(browserService as any).lastPage = page
      return result
    }),
    lastPage: undefined as any,
  }

  const scraperConfig: ScraperConfig = {
    // Default scraper settings
    defaultMode: 'extractor',
    defaultTaskTimeoutSecs: 60,
    defaultUserAgent: 'auto',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',

    // Playwright settings
    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,

    // Fingerprint settings
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,

    globalMaxConcurrency: 3,
    dataLifetimeMins: 60,
    cleanupIntervalMins: 10,
  } as ScraperConfig

  beforeAll(async () => {
    const configService = createMockConfigService({ scraper: scraperConfig })

    moduleRef = await Test.createTestingModule({
      providers: [
        ScraperService,
        { provide: ConfigService, useValue: configService },
        { provide: FingerprintService, useValue: fingerprintService },
        { provide: PinoLogger, useValue: logger },
        { provide: TurndownConverterService, useValue: createMockTurndownConverterService() },
        { provide: 'IArticleExtractor', useValue: articleExtractor },
        {
          provide: ConcurrencyService,
          useValue: {
            run: <T>(fn: () => Promise<T>) => fn(),
          },
        },
        { provide: BrowserService, useValue: browserService },
      ],
    }).compile()

    service = moduleRef.get(ScraperService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  it('scrapes page via extractor mode using article extractor', async () => {
    const dto: ScraperRequestDto = { url: 'https://example.com', mode: 'extractor' } as any

    const res = await service.scrapePage(dto)

    expect(res.url).toBe(dto.url)
    expect(res.body).toContain('Mocked Markdown')
    expect(articleExtractor.extract).toHaveBeenCalled()
  })

  it('scrapes page via playwright mode using crawlee flow', async () => {
    const dto: ScraperRequestDto = {
      url: 'https://example.com/playwright',
      mode: 'playwright',
      taskTimeoutSecs: 60,
    } as any

    const res = await service.scrapePage(dto)

    expect(res.url).toBe(dto.url)
    expect(res.body).toContain('Mocked Markdown')
    expect(articleExtractor.extractFromHtml).toHaveBeenCalled()

    const page = (browserService as any).lastPage
    expect(page.goto).toHaveBeenCalledWith(dto.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
  })

  it('returns raw HTML when rawBody=true and sets meta.rawBody', async () => {
    const dto: ScraperRequestDto = {
      url: 'https://example.com/raw',
      mode: 'extractor',
      rawBody: true,
    } as any

    const res = await service.scrapePage(dto)

    // Should not be converted to Markdown
    expect(res.body).toContain('<p>')
    expect(res.body).not.toContain('Mocked Markdown')
    expect(res.meta?.rawBody).toBe(true)
  })
})
