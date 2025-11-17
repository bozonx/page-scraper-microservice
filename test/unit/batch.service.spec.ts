import { BatchService } from '@/modules/scraper/services/batch.service.js'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from '@/modules/scraper/services/scraper.service.js'
import { WebhookService } from '@/modules/scraper/services/webhook.service.js'
import { createMockConfigService, createMockLogger } from '@test/helpers/mocks.js'
import type { BatchRequestDto, BatchJobStatus } from '@/modules/scraper/dto/batch.dto.js'

describe('BatchService (unit)', () => {
  let batchService: BatchService
  let configService: ConfigService
  let scraperService: jest.Mocked<ScraperService>
  let webhookService: jest.Mocked<WebhookService>
  let logger: PinoLogger

  beforeEach(() => {
    configService = createMockConfigService({
      scraper: {
        batchConcurrency: 1,
        batchMinDelayMs: 1500,
        batchMaxDelayMs: 4000,
      },
    }) as unknown as ConfigService

    scraperService = {
      scrapePage: jest.fn(),
    } as unknown as jest.Mocked<ScraperService>

    webhookService = {
      sendWebhook: jest.fn(),
    } as unknown as jest.Mocked<WebhookService>

    logger = createMockLogger()

    batchService = new BatchService(configService, scraperService, webhookService, logger)
  })

  it('cleans up only batch jobs older than TTL', () => {
    // Access private jobs map via type assertion for testing
    const jobsMap = (batchService as any).jobs as Map<string, any>

    // Create mock batch jobs with different creation times
    const oldJobId = 'old-job-id'
    const youngJobId = 'young-job-id'

    const mockRequest: BatchRequestDto = {
      items: [{ url: 'https://example.com' }],
    }

    const oldJob = {
      id: oldJobId,
      status: 'succeeded' as BatchJobStatus,
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      total: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
      results: [],
      request: mockRequest,
    }

    const youngJob = {
      id: youngJobId,
      status: 'succeeded' as BatchJobStatus,
      createdAt: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
      total: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
      results: [],
      request: mockRequest,
    }

    // Add jobs to the private map
    jobsMap.set(oldJobId, oldJob)
    jobsMap.set(youngJobId, youngJob)

    // Verify jobs are added
    expect(jobsMap.size).toBe(2)
    expect(jobsMap.has(oldJobId)).toBe(true)
    expect(jobsMap.has(youngJobId)).toBe(true)

    // Run cleanup with 5-minute TTL
    const removed = batchService.cleanupOlderThan(5 * 60 * 1000) // 5 minutes in milliseconds

    // Verify only old job was removed
    expect(removed).toBe(1)
    expect(jobsMap.size).toBe(1)
    expect(jobsMap.has(oldJobId)).toBe(false)
    expect(jobsMap.has(youngJobId)).toBe(true)
  })
})
