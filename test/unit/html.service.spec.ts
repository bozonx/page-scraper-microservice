import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from '@/modules/scraper/services/scraper.service.js'
import { FingerprintService } from '@/modules/scraper/services/fingerprint.service.js'
import { TurndownConverterService } from '@/modules/scraper/services/turndown.service.js'
import type { HtmlRequestDto } from '@/modules/scraper/dto/html-request.dto.js'
import type { ScraperConfig } from '@/config/scraper.config.js'
import {
  createMockLogger,
  createMockConfigService,
  createMockTurndownConverterService,
  createMockArticleExtractor,
} from '@test/helpers/mocks.js'

describe('ScraperService - getHtml (unit)', () => {
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

    // Batch processing settings
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    batchConcurrency: 1,
    dataLifetimeMins: 60,

    // Webhook settings
    webhookTimeoutMs: 10000,
    defaultWebhookBackoffMs: 1000,
    defaultWebhookMaxAttempts: 3,
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

  it('retrieves raw HTML using Playwright', async () => {
    const dto: HtmlRequestDto = { url: 'https://example.com/html' } as any

    const res = await service.getHtml(dto)

    expect(res.url).toBe(dto.url)
    expect(res.html).toBeDefined()
    expect(typeof res.html).toBe('string')
    expect(res.html).toContain('<html>')
  })

  it('applies fingerprint configuration', async () => {
    const dto: HtmlRequestDto = {
      url: 'https://example.com/fingerprint',
      fingerprint: {
        generate: true,
        userAgent: 'Custom UA',
      },
    } as any

    const res = await service.getHtml(dto)

    expect(res.url).toBe(dto.url)
    expect(res.html).toBeDefined()
    expect(fingerprintService.generateFingerprint).toHaveBeenCalled()
  })

  it('applies custom timeout', async () => {
    const dto: HtmlRequestDto = {
      url: 'https://example.com/timeout',
      taskTimeoutSecs: 60,
    } as any

    const res = await service.getHtml(dto)

    expect(res.url).toBe(dto.url)
    expect(res.html).toBeDefined()
  })

  it('applies locale and timezone settings', async () => {
    const dto: HtmlRequestDto = {
      url: 'https://example.com/locale',
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow',
    } as any

    const res = await service.getHtml(dto)

    expect(res.url).toBe(dto.url)
    expect(res.html).toBeDefined()
  })

  it('applies blocking settings', async () => {
    const dto: HtmlRequestDto = {
      url: 'https://example.com/blocking',
      blockTrackers: true,
      blockHeavyResources: true,
    } as any

    const res = await service.getHtml(dto)

    expect(res.url).toBe(dto.url)
    expect(res.html).toBeDefined()
  })
})
