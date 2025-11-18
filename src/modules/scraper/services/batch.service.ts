import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '@/config/scraper.config.js'
import { ScraperService } from './scraper.service.js'
import { WebhookService } from './webhook.service.js'
import {
  BatchRequestDto,
  BatchResponseDto,
  BatchJobStatusDto,
  BatchJobStatus,
  BatchItemResultDto,
  BatchWebhookPayloadDto,
  BatchItemDto,
  BatchCommonSettingsDto,
  BatchMetaDto,
} from '../dto/batch.dto.js'
import { ScraperRequestDto } from '../dto/scraper-request.dto.js'
import { ScraperResponseDto } from '../dto/scraper-response.dto.js'

/**
 * Internal batch job interface
 * Represents a batch job with its current state and results
 */
interface BatchJob {
  /**
   * Unique identifier for batch job
   */
  id: string
  
  /**
   * Current status of batch job
   */
  status: BatchJobStatus
  
  /**
   * Timestamp when job was created
   */
  createdAt: Date
  
  /**
   * Timestamp when job completed (if completed)
   */
  completedAt?: Date
  
  /**
   * Total number of items in the batch
   */
  total: number
  
  /**
   * Number of items that have been processed
   */
  processed: number
  
  /**
   * Number of items that were successfully processed
   */
  succeeded: number
  
  /**
   * Number of items that failed to process
   */
  failed: number
  
  /**
   * Array of individual item results
   */
  results: BatchItemResultDto[]
  
  /**
   * Original batch request
   */
  request: BatchRequestDto
  
  /**
   * Cancellation was requested (e.g., service shutdown)
   */
  cancelRequested?: boolean

  /**
   * When false, results from in-flight tasks are ignored (post-cancel)
   */
  acceptResults?: boolean

  /**
   * Whether job has been force-finalized (e.g., during shutdown). Prevents duplicate finalization/webhook.
   */
  finalized?: boolean

  /**
   * Whether any item processing has started
   */
  startedAny?: boolean

  /**
   * First error captured for attribution when job fails with zero successes
   */
  firstError?: { message: string; details?: string }

  /**
   * Completion metadata
   */
  meta?: BatchMetaDto
}

/**
 * Service for managing batch scraping jobs
 * Handles job creation, execution, status tracking, and cleanup
 */
@Injectable()
export class BatchService implements OnApplicationShutdown, OnModuleInit {
  private readonly jobs = new Map<string, BatchJob>()

  constructor(
    private readonly configService: ConfigService,
    private readonly scraperService: ScraperService,
    private readonly webhookService: WebhookService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(BatchService.name)
  }

  /**
   * On startup, if any jobs are present and unfinished (should not normally happen),
   * finalize them as failed to reflect unexpected hard shutdown.
   */
  async onModuleInit(): Promise<void> {
    const finalizePromises: Promise<void>[] = []
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'running' || job.status === 'queued') {
        job.meta = {
          ...(job.meta || {}),
          error: {
            kind: 'pre_start',
            message: 'Detected unfinished batch at startup',
          },
        }
        this.updateJobStatus(jobId, 'failed')
        if (job.request.webhook) {
          const p = this.sendWebhook(jobId).catch((err) => {
            this.logger.error(`Failed to send webhook for job ${jobId} at startup:`, err)
          })
          finalizePromises.push(p)
        }
      }
    }
    if (finalizePromises.length > 0) {
      await Promise.allSettled(finalizePromises)
    }
  }

  /**
   * Creates a new batch job and starts processing
   * @param request Batch job parameters
   * @returns Batch job creation response with job ID
   */
  async createBatchJob(request: BatchRequestDto): Promise<BatchResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!


    // Generate unique job ID
    const { v4: uuidv4 } = await import('uuid')
    const jobId = uuidv4()

    // Create job object
    const job: BatchJob = {
      id: jobId,
      status: 'queued',
      createdAt: new Date(),
      total: request.items.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      request,
      cancelRequested: false,
      acceptResults: true,
      finalized: false,
      startedAny: false,
    }

    // Store job
    this.jobs.set(jobId, job)
    this.logger.info(`Created batch job ${jobId} with ${request.items.length} items`)

    // Transition to running status on next tick to keep initial status as 'queued'
    setTimeout(() => {
      this.updateJobStatus(jobId, 'running')
    }, 0)

    // Start processing batch (do not await here)
    this.processBatchJob(jobId).catch((error) => {
      this.logger.error(`Error processing batch job ${jobId}:`, error)
      this.updateJobStatus(jobId, 'failed')
    })

    return { jobId }
  }

  /**
   * Retrieves current status of a batch job
   * @param jobId Job ID to look up
   * @returns Current job status or null if not found
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJobStatusDto | null> {
    const job = this.jobs.get(jobId)
    if (!job) {
      return null
    }

    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      meta: job.meta,
    }
  }

  /**
   * Processes a batch job with concurrency control and delays
   * @param jobId Job ID to process
   */
  private async processBatchJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    let scraperConfig: ScraperConfig
    let schedule: any
    try {
      scraperConfig = this.configService.get<ScraperConfig>('scraper')!
      schedule = job.request.schedule || {}
    } catch (err) {
      // Pre-start error before any item began
      job.meta = {
        ...(job.meta || {}),
        error: {
          kind: 'pre_start',
          message: err instanceof Error ? err.message : String(err),
        },
      }
      this.updateJobStatus(jobId, 'failed')
      if (job.request.webhook) {
        await this.sendWebhook(jobId).catch((error) => {
          this.logger.error(`Failed to send webhook for job ${jobId}:`, error)
        })
      }
      return
    }

    // Apply scheduling: concurrency, delays and jitter
    const concurrency = schedule.concurrency ?? scraperConfig.batchConcurrency
    const minDelayMs = schedule.minDelayMs ?? scraperConfig.batchMinDelayMs
    const maxDelayMs = schedule.maxDelayMs ?? scraperConfig.batchMaxDelayMs
    const jitter = schedule.jitter ?? true

    const items = [...job.request.items]

    let index = 0

    // Worker function that processes items sequentially with delays
    const worker = async () => {
      while (true) {
        if (job.cancelRequested) break
        const current = index++
        if (current >= items.length) break

        const item = items[current]

        // Add delay between requests (except for very first processed by this worker)
        if (current >= concurrency) {
          const delay = this.calculateDelay(minDelayMs, maxDelayMs, jitter)
          await this.sleep(delay)
        }

        if (job.cancelRequested) break
        await this.processBatchItem(jobId, item)
      }
    }

    // Create and run workers in parallel
    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker())
    await Promise.allSettled(workers)

    // If job was force-finalized during shutdown, skip normal finalization
    if (job.finalized) {
      return
    }

    // Determine final status
    const finalStatus = this.determineFinalStatus(job)
    this.updateJobStatus(jobId, finalStatus)

    // Send webhook if configured
    if (job.request.webhook) {
      await this.sendWebhook(jobId).catch((error) => {
        this.logger.error(`Failed to send webhook for job ${jobId}:`, error)
      })
    }

    // Cleanup is handled centrally by CleanupService
  }

  /**
   * Processes a single item in a batch job
   * @param jobId Job ID
   * @param item Item to process
   */
  private async processBatchItem(jobId: string, item: BatchItemDto): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    try {
      if (job.cancelRequested) return
      job.startedAny = true
      // Build scraper request from common settings and item-specific settings
      const scraperRequest: ScraperRequestDto = this.buildScraperRequest(
        job.request.commonSettings,
        item
      )

      const result = await this.scraperService.scrapePage(scraperRequest)

      const itemResult: BatchItemResultDto = {
        url: item.url,
        status: 'succeeded',
        data: result,
      }

      if (job.acceptResults !== false) {
        this.addJobResult(jobId, itemResult, true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const errorObj = {
        code: 422,
        message: 'Failed to extract content from page',
        details: errorMessage,
      }

      const itemResult: BatchItemResultDto = {
        url: item.url,
        status: 'failed',
        error: errorObj,
      }

      // Capture first error attribution
      if (!job.firstError) {
        job.firstError = { message: errorObj.message, details: errorObj.details }
      }

      if (job.acceptResults !== false) {
        this.addJobResult(jobId, itemResult, false)
      }
    }
  }

  /**
   * Updates status of a batch job
   * @param jobId Job ID
   * @param status New status
   */
  private updateJobStatus(jobId: string, status: BatchJobStatus): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = status
      if (['succeeded', 'failed', 'partial'].includes(status)) {
        job.completedAt = new Date()
      }

      // Attach meta for partial/failed as required
      if (status === 'partial') {
        job.meta = {
          ...(job.meta || {}),
          completedCount: job.succeeded + job.failed,
        }
      }
      if (status === 'failed' && job.succeeded === 0) {
        job.meta = {
          ...(job.meta || {}),
          error: job.meta?.error ?? {
            kind: job.startedAny ? 'first_item' : 'pre_start',
            message: job.firstError?.message || 'Batch failed',
            details: job.firstError?.details,
          },
        }
      }
    }
  }

  /**
   * Adds a result to a batch job and updates counters
   * @param jobId Job ID
   * @param result Item result
   * @param succeeded Whether item was processed successfully
   */
  private addJobResult(jobId: string, result: BatchItemResultDto, succeeded: boolean): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.results.push(result)
      job.processed++
      if (succeeded) {
        job.succeeded++
      } else {
        job.failed++
      }
    }
  }

  /**
   * Determines final status of a completed batch job
   * @param job Batch job to evaluate
   * @returns Final job status
   */
  private determineFinalStatus(job: BatchJob): BatchJobStatus {
    if (job.failed === 0) {
      return 'succeeded'
    }
    if (job.succeeded === 0) {
      return 'failed'
    }
    return 'partial'
  }

  /**
   * Sends webhook notification for completed batch job
   * @param jobId Job ID
   */
  private async sendWebhook(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job || !job.request.webhook) {
      return
    }

    const webhookConfig = job.request.webhook
    const payload: BatchWebhookPayloadDto = {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || '',
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      results: job.results,
      meta: job.meta,
    }

    await this.webhookService.sendWebhook(webhookConfig, payload)
  }

  /**
   * Removes jobs older than provided TTL
   */
  public cleanupOlderThan(ttlMs: number): number {
    const now = Date.now()
    let removed = 0
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt.getTime() >= ttlMs) {
        this.jobs.delete(id)
        removed++
      }
    }
    return removed
  }

  /**
   * Calculates delay between requests with optional jitter
   * @param minMs Minimum delay in milliseconds
   * @param maxMs Maximum delay in milliseconds
   * @param jitter Whether to add random jitter
   * @returns Calculated delay in milliseconds
   */
  private calculateDelay(minMs: number, maxMs: number, jitter: boolean): number {
    let delay = Math.random() * (maxMs - minMs) + minMs

    if (jitter) {
      // Add ±20% jitter
      const jitterAmount = delay * 0.2
      delay += (Math.random() - 0.5) * jitterAmount
    }

    return Math.round(delay)
  }

  /**
   * Simple sleep utility for delaying execution
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after specified delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Builds a scraper request from common settings and item-specific settings
   * @param common Common settings for the batch
   * @param item Specific item settings
   * @returns Combined scraper request
   */
  private buildScraperRequest(
    common: BatchCommonSettingsDto | undefined,
    item: BatchItemDto
  ): ScraperRequestDto {
    return {
      ...(common || {}),
      ...item,
      url: item.url,
    } as ScraperRequestDto
  }

  /**
   * Handle application shutdown: cancel all running/queued jobs and finalize as partial.
   * Wait for one-shot webhook delivery (success or failure) before returning.
   */
  async onApplicationShutdown(_signal?: string): Promise<void> {
    const finalizePromises: Promise<void>[] = []

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.finalized) continue
      if (job.status === 'running' || job.status === 'queued') {
        // Request cancellation and stop accepting results
        job.cancelRequested = true
        job.acceptResults = false

        // Finalize immediately as partial and report how many items completed
        job.meta = {
          ...(job.meta || {}),
          completedCount: job.succeeded + job.failed,
        }
        job.finalized = true
        this.updateJobStatus(jobId, 'partial')

        if (job.request.webhook) {
          const p = this.sendWebhook(jobId).catch((err) => {
            this.logger.error(`Failed to send webhook for job ${jobId} during shutdown:`, err)
          })
          finalizePromises.push(p)
        }
      }
    }

    // Await all webhooks (one-shot) before shutdown completes
    if (finalizePromises.length > 0) {
      await Promise.allSettled(finalizePromises)
    }
  }
}