import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from '@/modules/scraper/services/scraper.service.js'
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

describe('ScraperService (unit)', () => {
  let moduleRef: TestingModule
  let service: ScraperService

  // Shared mocks
  const logger = createMockLogger()
  const articleExtractor = createMockArticleExtractor()
  const fingerprintService: Partial<FingerprintService> = {
    generateFingerprint: jest.fn(() => ({
      userAgent: 'UA',
      viewport: { width: 1280, height: 720 },
      browserName: 'chrome',
      platform: 'Linux x86_64',
      language: 'en-US',
      timezone: 'UTC',
      webgl: { vendor: 'Google Inc.', renderer: 'WebKit WebGL', version: 'WebGL 2.0' },
      canvas: { fingerprint: 'abc123', hacked: false },
      audio: { contextId: 1 },
      plugins: [],
      fonts: ['Arial'],
      screen: { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
      hardware: { cores: 4, memory: 8, deviceMemory: 8 },
    })),
    shouldRotateFingerprint: jest.fn(() => false),
  }

  const scraperConfig: ScraperConfig = {
    // Default scraper settings
    defaultMode: 'extractor',
    defaultTaskTimeoutSecs: 30,
    defaultUserAgent: 'auto',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',
    defaultDateLocale: 'en',

    // Playwright settings
    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,

    // Fingerprint settings
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,

    // Batch processing settings (not directly used here, but present for completeness)
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    batchConcurrency: 1,
    batchDataLifetimeMins: 60,

    // Webhook settings
    webhookTimeoutMs: 10000,
    webhookBackoffMs: 1000,
    webhookMaxAttempts: 3,
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
    } as any

    const res = await service.scrapePage(dto)

    expect(res.url).toBe(dto.url)
    expect(res.body).toContain('Mocked Markdown')
    expect(articleExtractor.extractFromHtml).toHaveBeenCalled()
  })
})
