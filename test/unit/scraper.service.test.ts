import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { ScraperService } from '@/modules/scraper/services/scraper.service'
import { FingerprintService } from '@/modules/scraper/services/fingerprint.service'
import { ScraperRequestDto } from '@/modules/scraper/dto/scraper-request.dto'
import { ScraperResponseDto } from '@/modules/scraper/dto/scraper-response.dto'
import { ScraperConfig } from '@/config/scraper.config'

// Mock external dependencies
jest.mock('@extractus/article-extractor', () => ({
  extract: jest.fn(),
}))

jest.mock('turndown')

jest.mock('crawlee', () => ({
  PlaywrightCrawler: jest.fn().mockImplementation(() => ({
    addRequests: jest.fn(),
    run: jest.fn().mockResolvedValue(undefined),
  })),
}))

// Import mocked modules
const { extract } = require('@extractus/article-extractor')
const TurndownService = require('turndown')

describe('ScraperService', () => {
  let service: ScraperService
  let configService: ConfigService
  let fingerprintService: FingerprintService
  let moduleRef: TestingModule

  const mockScraperConfig: ScraperConfig = {
    defaultMode: 'cheerio',
    defaultTaskTimeoutSecs: 30,
    defaultUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',
    defaultDateLocale: 'en',
    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    batchConcurrency: 1,
    batchMaxItems: 100,
    batchDataLifetimeMins: 60,
    webhookTimeoutMs: 10000,
    webhookBackoffMs: 1000,
    webhookMaxAttempts: 3,
  }

  const mockExtractedContent = {
    title: 'Test Article',
    description: 'Test description',
    content: '<h1>Test Content</h1><p>This is a test article</p>',
    publishedTime: '2023-01-01T00:00:00.000Z',
    author: 'Test Author',
    lang: 'en',
  }

  const mockFingerprint = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1920, height: 1080 },
    browserName: 'chrome',
    platform: 'Win32',
    language: 'en-US',
    timezone: 'America/New_York',
    webgl: {
      vendor: 'Google Inc.',
      renderer: 'ANGLE (Intel, Intel(R) HD Graphics 630)',
      version: 'WebGL 2.0',
    },
    canvas: {
      fingerprint: 'abc123',
      hacked: false,
    },
    audio: {
      contextId: 1,
    },
    plugins: ['Chrome PDF Plugin'],
    fonts: ['Arial', 'Times New Roman'],
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
      pixelDepth: 24,
    },
    hardware: {
      cores: 4,
      memory: 8,
      deviceMemory: 8,
    },
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ScraperService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'scraper') {
                return mockScraperConfig
              }
              return undefined
            }),
          },
        },
        {
          provide: FingerprintService,
          useValue: {
            generateFingerprint: jest.fn().mockReturnValue(mockFingerprint),
            shouldRotateFingerprint: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile()

    service = moduleRef.get<ScraperService>(ScraperService)
    configService = moduleRef.get<ConfigService>(ConfigService)
    fingerprintService = moduleRef.get<FingerprintService>(FingerprintService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    extract.mockResolvedValue(mockExtractedContent)
  })

  describe('scrapePage', () => {
    const mockRequest: ScraperRequestDto = {
      url: 'https://example.com/article',
      mode: 'cheerio',
    }

    it('should scrape page using cheerio mode', async () => {
      const result = await service.scrapePage(mockRequest)

      expect(result).toEqual({
        url: mockRequest.url,
        title: mockExtractedContent.title,
        description: mockExtractedContent.description,
        date: mockExtractedContent.publishedTime,
        author: mockExtractedContent.author,
        body: '# Test Content\n\nThis is a test article',
        meta: {
          lang: mockExtractedContent.lang,
          readTimeMin: 1, // Based on word count
        },
      })

      expect(extract).toHaveBeenCalledWith(mockRequest.url)
      expect(configService.get).toHaveBeenCalledWith('scraper')
    })

    it('should scrape page using playwright mode', async () => {
      const playwrightRequest: ScraperRequestDto = {
        ...mockRequest,
        mode: 'playwright',
      }

      // Mock PlaywrightCrawler behavior
      const { PlaywrightCrawler } = require('crawlee')
      let mockRequestHandler: any

      PlaywrightCrawler.mockImplementation((options: any) => {
        mockRequestHandler = options.requestHandler
        return {
          addRequests: jest.fn(),
          run: jest.fn().mockImplementation(async () => {
            // Simulate the request handler being called
            await mockRequestHandler({
              page: {
                addInitScript: jest.fn(),
                setViewportSize: jest.fn(),
                route: jest.fn(),
                goto: jest.fn(),
                content: jest.fn().mockResolvedValue('<html>...</html>'),
              },
            })
          }),
        }
      })

      const result = await service.scrapePage(playwrightRequest)

      expect(result).toEqual({
        url: playwrightRequest.url,
        title: mockExtractedContent.title,
        description: mockExtractedContent.description,
        date: mockExtractedContent.publishedTime,
        author: mockExtractedContent.author,
        body: '# Test Content\n\nThis is a test article',
        meta: {
          lang: mockExtractedContent.lang,
          readTimeMin: 1,
        },
      })

      expect(fingerprintService.generateFingerprint).toHaveBeenCalled()
      expect(extract).toHaveBeenCalled()
    })

    it('should use default mode when mode is not specified', async () => {
      const requestWithoutMode: ScraperRequestDto = {
        url: 'https://example.com/article',
      }

      const result = await service.scrapePage(requestWithoutMode)

      expect(result).toBeDefined()
      expect(extract).toHaveBeenCalledWith(requestWithoutMode.url)
    })

    it('should handle extraction errors', async () => {
      extract.mockRejectedValue(new Error('Extraction failed'))

      await expect(service.scrapePage(mockRequest)).rejects.toThrow('Extraction failed')
    })

    it('should calculate read time correctly', async () => {
      // Mock content with approximately 400 words
      const longContent = 'word '.repeat(400)
      extract.mockResolvedValue({
        ...mockExtractedContent,
        content: `<p>${longContent}</p>`,
      })

      const result = await service.scrapePage(mockRequest)

      expect(result.meta?.readTimeMin).toBe(2) // 400 words / 200 words per minute = 2 minutes
    })

    it('should handle empty content gracefully', async () => {
      extract.mockResolvedValue({
        ...mockExtractedContent,
        content: undefined,
      })

      const result = await service.scrapePage(mockRequest)

      expect(result.body).toBe('')
      expect(result.meta?.readTimeMin).toBe(0)
    })
  })

  describe('scrapeWithPlaywright with retry mechanism', () => {
    const playwrightRequest: ScraperRequestDto = {
      url: 'https://example.com/article',
      mode: 'playwright',
      fingerprint: {
        generate: true,
        rotateOnAntiBot: true,
      },
    }

    it('should retry with new fingerprint on anti-bot detection', async () => {
      const { PlaywrightCrawler } = require('crawlee')
      let attemptCount = 0

      PlaywrightCrawler.mockImplementation((options: any) => {
        return {
          addRequests: jest.fn(),
          run: jest.fn().mockImplementation(async () => {
            attemptCount++
            if (attemptCount === 1) {
              // Simulate anti-bot detection on first attempt
              options.failedRequestHandler({
                request: { url: playwrightRequest.url },
                error: new Error('cloudflare detected bot'),
              })
            } else {
              // Succeed on second attempt
              await options.requestHandler({
                page: {
                  addInitScript: jest.fn(),
                  setViewportSize: jest.fn(),
                  route: jest.fn(),
                  goto: jest.fn(),
                  content: jest.fn().mockResolvedValue('<html>...</html>'),
                },
              })
            }
          }),
        }
      })

      // Mock fingerprint rotation detection
      jest
        .spyOn(fingerprintService, 'shouldRotateFingerprint')
        .mockReturnValueOnce(true) // First error should trigger rotation
        .mockReturnValueOnce(false) // Second attempt should not rotate

      const result = await service.scrapePage(playwrightRequest)

      expect(result).toBeDefined()
      expect(fingerprintService.generateFingerprint).toHaveBeenCalledTimes(2) // Initial + retry
      expect(fingerprintService.shouldRotateFingerprint).toHaveBeenCalled()
    })

    it('should throw error after max retries', async () => {
      const { PlaywrightCrawler } = require('crawlee')

      PlaywrightCrawler.mockImplementation((options: any) => {
        return {
          addRequests: jest.fn(),
          run: jest.fn().mockImplementation(async () => {
            // Always fail
            options.failedRequestHandler({
              request: { url: playwrightRequest.url },
              error: new Error('persistent anti-bot detection'),
            })
          }),
        }
      })

      // Always trigger fingerprint rotation
      jest.spyOn(fingerprintService, 'shouldRotateFingerprint').mockReturnValue(true)

      await expect(service.scrapePage(playwrightRequest)).rejects.toThrow()
    })
  })
})
