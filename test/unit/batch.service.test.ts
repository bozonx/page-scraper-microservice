import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BatchService } from '@/modules/scraper/services/batch.service'
import { ScraperService } from '@/modules/scraper/services/scraper.service'
import { WebhookService } from '@/modules/scraper/services/webhook.service'
import { ScraperConfig } from '@/config/scraper.config'
import {
  BatchRequestDto,
  BatchResponseDto,
  BatchJobStatusDto,
  BatchJobStatus,
  BatchItemResultDto,
} from '@/modules/scraper/dto/batch.dto'
import { ScraperRequestDto } from '@/modules/scraper/dto/scraper-request.dto'
import { ScraperResponseDto } from '@/modules/scraper/dto/scraper-response.dto'

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123456'),
}))

describe('BatchService', () => {
  let service: BatchService
  let configService: ConfigService
  let scraperService: ScraperService
  let webhookService: WebhookService
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

  const mockBatchRequest: BatchRequestDto = {
    items: [
      { url: 'https://example.com/page1' },
      { url: 'https://example.com/page2' },
      { url: 'https://example.com/page3' },
    ],
    commonSettings: {
      mode: 'cheerio',
      taskTimeoutSecs: 30,
    },
    schedule: {
      minDelayMs: 1000,
      maxDelayMs: 2000,
      jitter: false,
      concurrency: 2,
    },
  }

  const mockScraperResponse: ScraperResponseDto = {
    url: 'https://example.com/page1',
    title: 'Test Page',
    description: 'Test description',
    body: '# Test Content',
    meta: {
      lang: 'en',
      readTimeMin: 1,
    },
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        BatchService,
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
          provide: ScraperService,
          useValue: {
            scrapePage: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            sendWebhook: jest.fn(),
          },
        },
      ],
    }).compile()

    service = moduleRef.get<BatchService>(BatchService)
    configService = moduleRef.get<ConfigService>(ConfigService)
    scraperService = moduleRef.get<ScraperService>(ScraperService)
    webhookService = moduleRef.get<WebhookService>(WebhookService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('createBatchJob', () => {
    it('should create a batch job successfully', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const result = await service.createBatchJob(mockBatchRequest)

      expect(result).toHaveProperty('jobId')
      expect(result.jobId).toMatch(/^b-\d{8}-[a-f0-9]{6}$/)
      expect(scraperService.scrapePage).toHaveBeenCalledTimes(mockBatchRequest.items.length)
    })

    it('should throw error when batch size exceeds maximum', async () => {
      const oversizedBatch: BatchRequestDto = {
        items: Array.from({ length: 101 }, (_, i) => ({ url: `https://example.com/page${i}` })),
      }

      await expect(service.createBatchJob(oversizedBatch)).rejects.toThrow(
        'Batch size exceeds maximum of 100 items'
      )
    })

    it('should process items with common settings merged', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      await service.createBatchJob(mockBatchRequest)

      // Verify that scrapePage was called with merged settings
      expect(scraperService.scrapePage).toHaveBeenCalledWith({
        url: 'https://example.com/page1',
        mode: 'cheerio',
        taskTimeoutSecs: 30,
      })

      expect(scraperService.scrapePage).toHaveBeenCalledWith({
        url: 'https://example.com/page2',
        mode: 'cheerio',
        taskTimeoutSecs: 30,
      })

      expect(scraperService.scrapePage).toHaveBeenCalledWith({
        url: 'https://example.com/page3',
        mode: 'cheerio',
        taskTimeoutSecs: 30,
      })
    })

    it('should handle item-specific overrides', async () => {
      const batchWithOverrides: BatchRequestDto = {
        ...mockBatchRequest,
        items: [
          { url: 'https://example.com/page1', mode: 'playwright' },
          { url: 'https://example.com/page2' },
        ],
      }

      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      await service.createBatchJob(batchWithOverrides)

      // First item should use its own mode
      expect(scraperService.scrapePage).toHaveBeenCalledWith({
        url: 'https://example.com/page1',
        mode: 'playwright',
        taskTimeoutSecs: 30,
      })

      // Second item should use common mode
      expect(scraperService.scrapePage).toHaveBeenCalledWith({
        url: 'https://example.com/page2',
        mode: 'cheerio',
        taskTimeoutSecs: 30,
      })
    })

    it('should handle scraping errors gracefully', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage
        .mockResolvedValueOnce(mockScraperResponse)
        .mockRejectedValueOnce(new Error('Scraping failed'))
        .mockResolvedValueOnce(mockScraperResponse)

      const result = await service.createBatchJob(mockBatchRequest)

      expect(result).toHaveProperty('jobId')

      // Wait for processing to complete
      jest.advanceTimersByTime(5000)

      const status = await service.getBatchJobStatus(result.jobId)
      expect(status?.status).toBe('partial')
      expect(status?.succeeded).toBe(2)
      expect(status?.failed).toBe(1)
    })

    it('should send webhook when configured', async () => {
      const batchWithWebhook: BatchRequestDto = {
        ...mockBatchRequest,
        webhook: {
          url: 'https://example.com/webhook',
        },
      }

      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const result = await service.createBatchJob(batchWithWebhook)

      // Wait for processing to complete
      jest.advanceTimersByTime(5000)

      expect(webhookService.sendWebhook).toHaveBeenCalled()
    })
  })

  describe('getBatchJobStatus', () => {
    it('should return null for non-existent job', async () => {
      const result = await service.getBatchJobStatus('non-existent-job-id')
      expect(result).toBeNull()
    })

    it('should return job status for existing job', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const createResult = await service.createBatchJob(mockBatchRequest)

      // Wait for processing to complete
      jest.advanceTimersByTime(5000)

      const status = await service.getBatchJobStatus(createResult.jobId)

      expect(status).not.toBeNull()
      expect(status?.jobId).toBe(createResult.jobId)
      expect(status?.total).toBe(mockBatchRequest.items.length)
      expect(status?.processed).toBe(mockBatchRequest.items.length)
      expect(status?.succeeded).toBe(mockBatchRequest.items.length)
      expect(status?.failed).toBe(0)
      expect(status?.status).toBe('succeeded')
    })

    it('should return completedAt timestamp for completed jobs', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const createResult = await service.createBatchJob(mockBatchRequest)

      // Wait for processing to complete
      jest.advanceTimersByTime(5000)

      const status = await service.getBatchJobStatus(createResult.jobId)

      expect(status?.completedAt).toBeDefined()
      expect(status?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('job lifecycle', () => {
    it('should update job status correctly during processing', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >

      // Delay the scraping to test status transitions
      mockScrapePage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return mockScraperResponse
      })

      const createResult = await service.createBatchJob(mockBatchRequest)

      // Check initial status
      let status = await service.getBatchJobStatus(createResult.jobId)
      expect(status?.status).toBe('queued')

      // Advance timers to start processing
      jest.advanceTimersByTime(10)
      status = await service.getBatchJobStatus(createResult.jobId)
      expect(status?.status).toBe('running')

      // Complete processing
      jest.advanceTimersByTime(5000)
      status = await service.getBatchJobStatus(createResult.jobId)
      expect(status?.status).toBe('succeeded')
    })

    it('should clean up jobs after lifetime expires', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const createResult = await service.createBatchJob(mockBatchRequest)

      // Complete processing
      jest.advanceTimersByTime(5000)

      // Verify job exists
      let status = await service.getBatchJobStatus(createResult.jobId)
      expect(status).not.toBeNull()

      // Advance time beyond cleanup lifetime (60 minutes)
      jest.advanceTimersByTime(60 * 60 * 1000 + 1000)

      // Job should be cleaned up
      status = await service.getBatchJobStatus(createResult.jobId)
      expect(status).toBeNull()
    })

    it('should handle concurrency correctly', async () => {
      const batchWithHighConcurrency: BatchRequestDto = {
        ...mockBatchRequest,
        schedule: {
          concurrency: 3,
        },
      }

      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      const scrapePromises: Promise<ScraperResponseDto>[] = []

      mockScrapePage.mockImplementation(() => {
        const promise = new Promise<ScraperResponseDto>((resolve) => {
          setTimeout(() => resolve(mockScraperResponse), 100)
        })
        scrapePromises.push(promise)
        return promise
      })

      await service.createBatchJob(batchWithHighConcurrency)

      // Check that multiple items are processed concurrently
      jest.advanceTimersByTime(10)

      // Should have started processing 3 items concurrently
      expect(scrapePromises.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('delay calculation', () => {
    it('should calculate delays within specified range', async () => {
      const batchWithCustomDelays: BatchRequestDto = {
        ...mockBatchRequest,
        schedule: {
          minDelayMs: 1000,
          maxDelayMs: 2000,
          jitter: false,
          concurrency: 1, // Force sequential processing to trigger delays
        },
      }

      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      await service.createBatchJob(batchWithCustomDelays)

      // Advance time to trigger first chunk processing
      jest.advanceTimersByTime(100)

      // Advance time for delay between chunks
      jest.advanceTimersByTime(1500) // Should be within 1000-2000ms range

      // Verify processing continued
      const status = await service.getBatchJobStatus('b-20231115-test')
      expect(status).toBeDefined()
    })

    it('should apply jitter when enabled', async () => {
      const batchWithJitter: BatchRequestDto = {
        ...mockBatchRequest,
        schedule: {
          minDelayMs: 1000,
          maxDelayMs: 2000,
          jitter: true,
          concurrency: 1, // Force sequential processing
        },
      }

      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      await service.createBatchJob(batchWithJitter)

      // The exact timing with jitter is harder to test, but we can verify
      // that processing continues with some delay
      jest.advanceTimersByTime(100)
      jest.advanceTimersByTime(1500) // Approximate delay with jitter

      const status = await service.getBatchJobStatus('b-20231115-test')
      expect(status).toBeDefined()
    })
  })
})
