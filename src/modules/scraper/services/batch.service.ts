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

interface BatchJob {
  id: string
  status: BatchJobStatus
  createdAt: Date
  completedAt?: Date
  total: number
  processed: number
  succeeded: number
  failed: number
  results: BatchItemResultDto[]
  request: BatchRequestDto
  cleanupTimeout?: NodeJS.Timeout
}

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

  async createBatchJob(request: BatchRequestDto): Promise<BatchResponseDto> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Validate batch size
    if (request.items.length > scraperConfig.batchMaxItems) {
      throw new Error(`Batch size exceeds maximum of ${scraperConfig.batchMaxItems} items`)
    }

    const { v4: uuidv4 } = await import('uuid')
    const jobId = uuidv4()

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

  private async processBatchJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const schedule = job.request.schedule || {}

    // Status transition is handled asynchronously in createBatchJob

    // Apply scheduling: concurrency, delays and jitter
    const concurrency = schedule.concurrency ?? scraperConfig.batchConcurrency
    const minDelayMs = schedule.minDelayMs ?? scraperConfig.batchMinDelayMs
    const maxDelayMs = schedule.maxDelayMs ?? scraperConfig.batchMaxDelayMs
    const jitter = schedule.jitter ?? true

    const items = [...job.request.items]

    let index = 0
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

  private async processBatchItem(jobId: string, item: BatchItemDto): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    try {
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

  private updateJobStatus(jobId: string, status: BatchJobStatus): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.status = status
      if (['succeeded', 'failed', 'partial'].includes(status)) {
        job.completedAt = new Date()
      }
    }
  }

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

  private determineFinalStatus(job: BatchJob): BatchJobStatus {
    if (job.failed === 0) {
      return 'succeeded'
    }
    if (job.succeeded === 0) {
      return 'failed'
    }
    return 'partial'
  }

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


  private calculateDelay(minMs: number, maxMs: number, jitter: boolean): number {
    let delay = Math.random() * (maxMs - minMs) + minMs

    if (jitter) {
      // Add ±20% jitter
      const jitterAmount = delay * 0.2
      delay += (Math.random() - 0.5) * jitterAmount
    }

    return Math.round(delay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

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