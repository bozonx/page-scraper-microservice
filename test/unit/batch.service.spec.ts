import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { BatchService } from '@/modules/scraper/services/batch.service.js'
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

  it('finalizes running batch as partial on shutdown and ignores unfinished tasks', async () => {
    const jobsMap = (batchService as any).jobs as Map<string, any>

    const jobId = 'running-job'
    const mockRequest: BatchRequestDto = {
      items: [{ url: 'https://a' }, { url: 'https://b' }],
      webhook: { url: 'https://example.com/webhook' },
    } as any

    jobsMap.set(jobId, {
      id: jobId,
      status: 'running' as BatchJobStatus,
      createdAt: new Date(),
      total: 2,
      processed: 1,
      succeeded: 1,
      failed: 0,
      results: [
        { url: 'https://a', status: 'succeeded', data: { url: 'https://a' } },
      ],
      request: mockRequest,
      cancelRequested: false,
      acceptResults: true,
      finalized: false,
      startedAny: true,
    })

    webhookService.sendWebhook.mockResolvedValue()

    await batchService.onApplicationShutdown()

    const job = jobsMap.get(jobId)
    expect(job.status).toBe('partial')
    expect(job.meta?.completedCount).toBe(1)
    expect(webhookService.sendWebhook).toHaveBeenCalledTimes(1)
    const args = webhookService.sendWebhook.mock.calls[0]
    expect(args[1].meta?.completedCount).toBe(1)
  })

  it('sets partial with completedCount=0 when no tasks finished on shutdown', async () => {
    const jobsMap = (batchService as any).jobs as Map<string, any>

    const jobId = 'running-empty'
    const mockRequest: BatchRequestDto = {
      items: [{ url: 'https://a' }],
      webhook: { url: 'https://example.com/webhook' },
    } as any

    jobsMap.set(jobId, {
      id: jobId,
      status: 'running' as BatchJobStatus,
      createdAt: new Date(),
      total: 1,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      request: mockRequest,
      cancelRequested: false,
      acceptResults: true,
      finalized: false,
      startedAny: false,
    })

    webhookService.sendWebhook.mockResolvedValue()

    await batchService.onApplicationShutdown()

    const job = jobsMap.get(jobId)
    expect(job.status).toBe('partial')
    expect(job.meta?.completedCount).toBe(0)
    expect(webhookService.sendWebhook).toHaveBeenCalledTimes(1)
    const args = webhookService.sendWebhook.mock.calls[0]
    expect(args[1].meta?.completedCount).toBe(0)
  })

  it('marks unfinished batches as failed at startup and sends webhook', async () => {
    const jobsMap = (batchService as any).jobs as Map<string, any>

    const jobId = 'unfinished-at-startup'
    const mockRequest: BatchRequestDto = {
      items: [{ url: 'https://a' }, { url: 'https://b' }],
      webhook: { url: 'https://example.com/webhook' },
    } as any

    jobsMap.set(jobId, {
      id: jobId,
      status: 'running' as BatchJobStatus,
      createdAt: new Date(),
      total: 2,
      processed: 1,
      succeeded: 0,
      failed: 1,
      results: [
        { url: 'https://a', status: 'failed', error: { code: 422, message: 'x' } },
      ],
      request: mockRequest,
    })

    webhookService.sendWebhook.mockResolvedValue()

    await batchService.onModuleInit()

    const job = jobsMap.get(jobId)
    expect(job.status).toBe('failed')
    expect(job.meta?.error?.kind).toBe('pre_start')
    expect(webhookService.sendWebhook).toHaveBeenCalledTimes(1)
  })

  it('failed batch captures first item error in meta as first_item', async () => {
    // Arrange scraper to always throw
    scraperService.scrapePage.mockRejectedValue(new Error('Boom'))

    const request: BatchRequestDto = {
      items: [
        { url: 'https://a' },
        { url: 'https://b' },
      ],
      // No webhook needed here
      schedule: { minDelayMs: 0, maxDelayMs: 0, concurrency: 1 } as any,
    } as any

    const { jobId } = await batchService.createBatchJob(request)

    // Wait until job reaches terminal state
    const waitUntil = async (predicate: () => boolean, timeoutMs = 2000) => {
      const start = Date.now()
      while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error('Timeout waiting for predicate')
        await new Promise((r) => setTimeout(r, 5))
      }
    }

    const jobsMap = (batchService as any).jobs as Map<string, any>
    await waitUntil(() => {
      const j = jobsMap.get(jobId)
      return !!j && (j.status === 'failed' || j.status === 'partial' || j.status === 'succeeded')
    })

    const status = await batchService.getBatchJobStatus(jobId)
    expect(status?.status).toBe('failed')
    expect(status?.meta?.error?.kind).toBe('first_item')
    expect(status?.meta?.error?.message).toBe('Failed to extract content from page')
    expect(status?.meta?.error?.details).toBe('Boom')
  })
})
