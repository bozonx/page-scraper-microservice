import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '@config/scraper.config'
import { ScraperService } from './scraper.service'
import { WebhookService } from './webhook.service'
import {
  BatchRequestDto,
  BatchResponseDto,
  BatchJobStatusDto,
  BatchJobStatus,
  BatchItemResultDto,
  BatchWebhookPayloadDto,
  BatchItemDto,
  BatchCommonSettingsDto,
} from '../dto/batch.dto'
import { ScraperRequestDto } from '../dto/scraper-request.dto'
import { ScraperResponseDto } from '../dto/scraper-response.dto'

/**
 * Internal batch job interface
 * Represents a batch job with its current state and results
 */
interface BatchJob {
  /**
   * Unique identifier for the batch job
   */
  id: string
  
  /**
   * Current status of the batch job
   */
  status: BatchJobStatus
  
  /**
   * Timestamp when the job was created
   */
  createdAt: Date
  
  /**
   * Timestamp when the job completed (if completed)
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
   * Timeout handle for automatic cleanup
   */
  cleanupTimeout?: NodeJS.Timeout
}

/**
 * Service for managing batch scraping jobs
 * Handles job creation, execution, status tracking, and cleanup
 */
@Injectable()
export class BatchService {
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
   * Creates a new batch job and starts processing
   * @param request Batch job parameters
   * @returns Batch job creation response with job ID
   */
  async createBatchJob(request: BatchRequestDto): Promise<BatchResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Validate batch size
    if (request.items.length > scraperConfig.batchMaxItems) {
      throw new Error(`Batch size exceeds maximum of ${scraperConfig.batchMaxItems} items`)
    }

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
   * Retrieves the current status of a batch job
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

    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const schedule = job.request.schedule || {}

    // Apply scheduling: concurrency, delays and jitter
    const concurrency = schedule.concurrency ?? scraperConfig.batchConcurrency
    const minDelayMs = schedule.minDelayMs ?? scraperConfig.batchMinDelayMs
    const maxDelayMs = schedule.maxDelayMs ?? scraperConfig.batchMaxDelayMs
    const jitter = schedule.jitter ?? true

    const items = [...job.request.items]

    let index = 0
    
    // Worker function that processes items sequentially with delays
    const worker = async () => {
      // Each worker processes multiple items in sequence with delays between items
      while (true) {
        const current = index++
        if (current >= items.length) break

        const item = items[current]

        // Add delay between requests (except for very first processed by this worker)
        if (current >= concurrency) {
          const delay = this.calculateDelay(minDelayMs, maxDelayMs, jitter)
          await this.sleep(delay)
        }

        await this.processBatchItem(jobId, item)
      }
    }

    // Create and run workers in parallel
    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker())
    await Promise.allSettled(workers)

    // Determine final status
    const finalStatus = this.determineFinalStatus(job)
    this.updateJobStatus(jobId, finalStatus)

    // Send webhook if configured
    if (job.request.webhook) {
      await this.sendWebhook(jobId).catch((error) => {
        this.logger.error(`Failed to send webhook for job ${jobId}:`, error)
      })
    }

    // Schedule cleanup
    this.scheduleCleanup(jobId)
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

      this.addJobResult(jobId, itemResult, true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const itemResult: BatchItemResultDto = {
        url: item.url,
        status: 'failed',
        error: {
          code: 422,
          message: 'Failed to extract content from the page',
          details: errorMessage,
        },
      }

      this.addJobResult(jobId, itemResult, false)
    }
  }

  /**
   * Updates the status of a batch job
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
    }
  }

  /**
   * Adds a result to a batch job and updates counters
   * @param jobId Job ID
   * @param result Item result
   * @param succeeded Whether the item was processed successfully
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
   * Determines the final status of a completed batch job
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
    }

    await this.webhookService.sendWebhook(webhookConfig, payload)
  }

  /**
   * Schedules cleanup of a batch job after configured lifetime
   * @param jobId Job ID to clean up
   */
  private scheduleCleanup(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const cleanupMs = scraperConfig.batchDataLifetimeMins * 60 * 1000

    job.cleanupTimeout = setTimeout(() => {
      this.jobs.delete(jobId)
      this.logger.info(`Cleaned up job ${jobId}`)
    }, cleanupMs)
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
   * @returns Promise that resolves after the specified delay
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
}