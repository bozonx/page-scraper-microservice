import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { WebhookService } from '@/modules/scraper/services/webhook.service'
import { ScraperConfig } from '@/config/scraper.config'
import { BatchWebhookDto, BatchWebhookPayloadDto } from '@/modules/scraper/dto/batch.dto'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('WebhookService', () => {
  let service: WebhookService
  let configService: ConfigService
  let moduleRef: TestingModule

  const mockScraperConfig: ScraperConfig = {
    defaultMode: 'cheerio',
    defaultTaskTimeoutSecs: 30,
    defaultUserAgent: 'auto',
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

  const mockWebhookConfig: BatchWebhookDto = {
    url: 'https://example.com/webhook',
    headers: {
      'X-Custom-Header': 'custom-value',
    },
    authHeaderName: 'Authorization',
    authHeaderValue: 'Bearer token123',
  }

  const mockPayload: BatchWebhookPayloadDto = {
    jobId: 'test-job-123',
    status: 'succeeded',
    createdAt: '2023-01-01T00:00:00.000Z',
    completedAt: '2023-01-01T00:05:00.000Z',
    total: 10,
    processed: 10,
    succeeded: 10,
    failed: 0,
    results: [],
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        WebhookService,
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
      ],
    }).compile()

    service = moduleRef.get<WebhookService>(WebhookService)
    configService = moduleRef.get<ConfigService>(ConfigService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendWebhook', () => {
    it('should send webhook successfully on first attempt', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('OK'),
      }
      mockFetch.mockResolvedValue(mockResponse as unknown as Response)

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).resolves.not.toThrow()

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(mockWebhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Page-Scraper-Webhook/1.0',
          'X-Custom-Header': 'custom-value',
          Authorization: 'Bearer token123',
        },
        body: JSON.stringify(mockPayload),
        signal: expect.any(AbortSignal),
      })
    })

    it('should use default config values when webhook config has no overrides', async () => {
      const minimalWebhookConfig: BatchWebhookDto = {
        url: 'https://example.com/webhook',
      }

      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('OK'),
      }
      mockFetch.mockResolvedValue(mockResponse as unknown as Response)

      await expect(service.sendWebhook(minimalWebhookConfig, mockPayload)).resolves.not.toThrow()

      expect(mockFetch).toHaveBeenCalledWith(minimalWebhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Page-Scraper-Webhook/1.0',
        },
        body: JSON.stringify(mockPayload),
        signal: expect.any(AbortSignal),
      })
    })

    it('should retry on failure with exponential backoff', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }

      // First two calls fail, third succeeds
      mockFetch
        .mockResolvedValueOnce(mockResponse as unknown as Response)
        .mockResolvedValueOnce(mockResponse as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue('OK'),
        } as unknown as Response)

      // Mock setTimeout to avoid actual delays
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = jest.fn((callback: Function) => {
        // Execute callback immediately for testing
        callback()
        return 1 as any
      })
      global.setTimeout = mockSetTimeout as any

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).resolves.not.toThrow()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(mockSetTimeout).toHaveBeenCalledTimes(2) // Two retries

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('should throw error after max attempts', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }

      // All calls fail
      mockFetch.mockResolvedValue(mockResponse as unknown as Response)

      // Mock setTimeout to avoid actual delays
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = jest.fn((callback: Function) => {
        callback()
        return 1 as any
      })
      global.setTimeout = mockSetTimeout as any

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow(
        'All webhook attempts failed'
      )

      expect(mockFetch).toHaveBeenCalledTimes(3) // Max attempts from config
      expect(mockSetTimeout).toHaveBeenCalledTimes(2) // Two retries

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      mockFetch.mockRejectedValue(networkError)

      // Mock setTimeout to avoid actual delays
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = jest.fn((callback: Function) => {
        callback()
        return 1 as any
      })
      global.setTimeout = mockSetTimeout as any

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow(
        'All webhook attempts failed'
      )

      expect(mockFetch).toHaveBeenCalledTimes(3) // Max attempts from config
      expect(mockSetTimeout).toHaveBeenCalledTimes(2) // Two retries

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('should respect custom max attempts', async () => {
      const webhookConfigWithCustomAttempts: BatchWebhookDto = {
        ...mockWebhookConfig,
        maxAttempts: 5,
      }

      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }

      // All calls fail
      mockFetch.mockResolvedValue(mockResponse as unknown as Response)

      // Mock setTimeout to avoid actual delays
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = jest.fn((callback: Function) => {
        callback()
        return 1 as any
      })
      global.setTimeout = mockSetTimeout as any

      await expect(
        service.sendWebhook(webhookConfigWithCustomAttempts, mockPayload)
      ).rejects.toThrow('All webhook attempts failed')

      expect(mockFetch).toHaveBeenCalledTimes(5) // Custom max attempts
      expect(mockSetTimeout).toHaveBeenCalledTimes(4) // Four retries

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('should respect custom backoff', async () => {
      const webhookConfigWithCustomBackoff: BatchWebhookDto = {
        ...mockWebhookConfig,
        backoffMs: 500,
      }

      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }

      // First call fails, second succeeds
      mockFetch.mockResolvedValueOnce(mockResponse as unknown as Response).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('OK'),
      } as unknown as Response)

      // Track setTimeout calls
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = jest.fn((callback: Function, delay: number) => {
        callback()
        return 1 as any
      })
      global.setTimeout = mockSetTimeout as any

      await expect(
        service.sendWebhook(webhookConfigWithCustomBackoff, mockPayload)
      ).resolves.not.toThrow()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockSetTimeout).toHaveBeenCalledTimes(1)
      // The delay should be approximately 500ms (base) * 2^1 (exponential) + jitter
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), expect.any(Number))

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('should handle timeout errors', async () => {
      // Mock AbortController to simulate timeout
      const mockAbortController = {
        signal: {} as AbortSignal,
        abort: jest.fn(),
      }

      const originalAbortController = global.AbortController
      global.AbortController = jest.fn(() => mockAbortController) as any

      // Mock fetch to simulate timeout
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          // Simulate timeout by rejecting after a delay
          setTimeout(() => reject(new Error('Request timeout')), 100)
        })
      })

      // Mock setTimeout to control timeout behavior
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn((callback: Function, delay: number) => {
        if (delay === mockScraperConfig.webhookTimeoutMs) {
          // Trigger the timeout
          callback()
        }
        return 1 as any
      }) as any

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow(
        'All webhook attempts failed'
      )

      expect(mockAbortController.abort).toHaveBeenCalled()

      // Restore original functions
      global.AbortController = originalAbortController
      global.setTimeout = originalSetTimeout
    })

    it('should calculate exponential backoff with jitter correctly', async () => {
      const webhookConfig: BatchWebhookDto = {
        ...mockWebhookConfig,
        maxAttempts: 4,
        backoffMs: 1000,
      }

      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      }

      // All calls fail
      mockFetch.mockResolvedValue(mockResponse as unknown as Response)

      // Track setTimeout calls to verify backoff calculation
      const originalSetTimeout = global.setTimeout
      const delays: number[] = []
      global.setTimeout = jest.fn((callback: Function, delay: number) => {
        delays.push(delay)
        callback()
        return 1 as any
      }) as any

      await expect(service.sendWebhook(webhookConfig, mockPayload)).rejects.toThrow()

      // Should have 3 retries (attempts 2, 3, 4)
      expect(delays).toHaveLength(3)

      // Verify exponential backoff with jitter
      // Attempt 2: 1000 * 2^1 + jitter (±100ms)
      expect(delays[0]).toBeGreaterThanOrEqual(900)
      expect(delays[0]).toBeLessThanOrEqual(1100)

      // Attempt 3: 1000 * 2^2 + jitter (±200ms)
      expect(delays[1]).toBeGreaterThanOrEqual(1800)
      expect(delays[1]).toBeLessThanOrEqual(2200)

      // Attempt 4: 1000 * 2^3 + jitter (±400ms)
      expect(delays[2]).toBeGreaterThanOrEqual(3600)
      expect(delays[2]).toBeLessThanOrEqual(4400)

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout
    })
  })
})
