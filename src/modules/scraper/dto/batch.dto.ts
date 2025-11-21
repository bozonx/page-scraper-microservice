import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  IsUrl,
  IsObject,
  ValidateNested,
  Min,
  Max,
  IsArray,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ScraperRequestDto, FingerprintConfigDto } from './scraper-request.dto.js'

/**
 * Batch item DTO
 * Represents a single URL to be scraped in a batch job
 */
export class BatchItemDto {
  /**
   * URL to scrape content from
   */
  @IsUrl()
  public url!: string

  /**
   * Scraper mode for this specific item (overrides common settings)
   */
  @IsOptional()
  @IsIn(['extractor', 'playwright'])
  public mode?: string

  /**
   * If true returns body as provided by extractor (no Markdown conversion)
   */
  @IsOptional()
  @IsBoolean()
  public rawBody?: boolean
}

/**
 * Batch scheduling configuration
 * Defines timing parameters for batch processing
 */
export class BatchScheduleDto {
  /**
   * Minimum delay between requests in milliseconds (500-3600000)
   */
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(3600000)
  public minDelayMs?: number

  /**
   * Maximum delay between requests in milliseconds (1000-3600000)
   */
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(3600000)
  public maxDelayMs?: number

  /**
   * Whether to add random jitter to delays to avoid detection
   */
  @IsOptional()
  @IsBoolean()
  public jitter?: boolean
}

/**
 * Batch webhook configuration
 * Defines parameters for sending batch completion notifications
 */
export class BatchWebhookDto {
  /**
   * URL to send webhook notification to
   */
  @IsString()
  public url!: string

  /**
   * Additional headers to include in webhook request
   */
  @IsOptional()
  @IsObject()
  public headers?: Record<string, string>

  /**
   * Backoff delay in milliseconds between webhook retry attempts (100-600000)
   */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(600000)
  public backoffMs?: number

  /**
   * Maximum number of retry attempts for failed webhook deliveries (1-100)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  public maxAttempts?: number
}

/**
 * Common settings applied to all items in a batch job
 */
export class BatchCommonSettingsDto {
  /**
   * Default scraper mode for all items
   */
  @IsOptional()
  @IsIn(['extractor', 'playwright'])
  public mode?: string

  /**
   * Default timeout for individual scraping tasks in seconds (>=1)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public taskTimeoutSecs?: number

  /**
   * If true returns body as provided by extractor (no Markdown conversion)
   */
  @IsOptional()
  @IsBoolean()
  public rawBody?: boolean

  /**
   * Whether to block trackers for all items
   */
  @IsOptional()
  @IsBoolean()
  public blockTrackers?: boolean

  /**
   * Whether to block heavy resources for all items
   */
  @IsOptional()
  @IsBoolean()
  public blockHeavyResources?: boolean

  /**
   * Default fingerprint configuration for all items
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto
}

/**
 * Batch job request DTO
 * Defines parameters for creating a new batch scraping job
 */
export class BatchRequestDto {
  /**
   * Array of URLs to scrape
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  public items!: BatchItemDto[]

  /**
   * Common settings applied to all items
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchCommonSettingsDto)
  public commonSettings?: BatchCommonSettingsDto

  /**
   * Scheduling configuration for batch processing
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchScheduleDto)
  public schedule?: BatchScheduleDto

  /**
   * Webhook configuration for batch completion notifications
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchWebhookDto)
  public webhook?: BatchWebhookDto
}

/**
 * Batch job creation response DTO
 */
export interface BatchResponseDto {
  /**
   * Unique identifier for the created batch job
   */
  jobId: string
}

/**
 * Batch job status type
 */
export type BatchJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'

/**
 * Batch job status meta information
 * Provides concise completion stats and first error message (if any)
 */
export interface StatusMetaDto {
  /**
   * Number of items that were successfully processed
   */
  succeeded: number

  /**
   * Number of items that failed to process
   */
  failed: number

  /**
   * Error message if an error occurred (either pre-start or first failed task)
   * Example: "Task 0 error: not found"
   */
  message?: string
}

/**
 * Batch job status response DTO
 */
export interface BatchJobStatusDto {
  /**
   * Unique identifier for the batch job
   */
  jobId: string

  /**
   * Current status of the batch job
   */
  status: BatchJobStatus

  /**
   * ISO timestamp when the job was created
   */
  createdAt: string

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
   * ISO timestamp when the job completed (if completed)
   */
  completedAt?: string

  /**
   * Status metadata including counters and first error message if present
   */
  statusMeta: StatusMetaDto
}

/**
 * Individual batch item result
 */
export interface BatchItemResultDto {
  /**
   * URL that was processed
   */
  url: string

  /**
   * Processing status for this item
   */
  status: 'succeeded' | 'failed'

  /**
   * Extracted data (if successful)
   */
  data?: any

  /**
   * Error details (if failed)
   */
  error?: {
    /**
     * HTTP status code
     */
    code: number

    /**
     * Error message
     */
    message: string

    /**
     * Optional detailed error information
     */
    details?: string
  }
}

/**
 * Batch webhook payload DTO
 * Defines structure of webhook notifications sent on batch completion
 */
export interface BatchWebhookPayloadDto {
  /**
   * Unique identifier for the batch job
   */
  jobId: string

  /**
   * Final status of the batch job
   */
  status: BatchJobStatus

  /**
   * ISO timestamp when the job was created
   */
  createdAt: string

  /**
   * ISO timestamp when the job completed
   */
  completedAt: string

  /**
   * Total number of items in the batch
   */
  total: number

  /**
   * Number of items that were processed
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
   * Status metadata including counters and first error message if present
   */
  statusMeta: StatusMetaDto
}
