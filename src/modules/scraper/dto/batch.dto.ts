import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  Max,
  IsObject,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ScraperRequestDto, FingerprintConfigDto } from './scraper-request.dto'

export class BatchItemDto {
  @IsUrl()
  public url!: string

  @IsOptional()
  @IsIn(['cheerio', 'playwright'])
  public mode?: string
}

export class BatchScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  public minDelayMs?: number

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  public maxDelayMs?: number

  @IsOptional()
  @IsBoolean()
  public jitter?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  public concurrency?: number
}

export class BatchWebhookDto {
  @IsString()
  public url!: string

  @IsOptional()
  @IsObject()
  public headers?: Record<string, string>

  @IsOptional()
  @IsString()
  public authHeaderName?: string

  @IsOptional()
  @IsString()
  public authHeaderValue?: string

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(30000)
  public backoffMs?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  public maxAttempts?: number
}

export class BatchCommonSettingsDto {
  @IsOptional()
  @IsIn(['cheerio', 'playwright'])
  public mode?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  public taskTimeoutSecs?: number

  @IsOptional()
  @IsString()
  public locale?: string

  @IsOptional()
  @IsString()
  public dateLocale?: string

  @IsOptional()
  @IsString()
  public timezoneId?: string

  @IsOptional()
  @IsBoolean()
  public blockTrackers?: boolean

  @IsOptional()
  @IsBoolean()
  public blockHeavyResources?: boolean

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto
}

export class BatchRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  public items!: BatchItemDto[]

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchCommonSettingsDto)
  public commonSettings?: BatchCommonSettingsDto

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchScheduleDto)
  public schedule?: BatchScheduleDto

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchWebhookDto)
  public webhook?: BatchWebhookDto
}

export interface BatchResponseDto {
  jobId: string
}

export type BatchJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'

export interface BatchJobStatusDto {
  jobId: string
  status: BatchJobStatus
  createdAt: string
  total: number
  processed: number
  succeeded: number
  failed: number
  completedAt?: string
}

export interface BatchItemResultDto {
  url: string
  status: 'succeeded' | 'failed'
  data?: any
  error?: {
    code: number
    message: string
    details?: string
  }
}

export interface BatchWebhookPayloadDto {
  jobId: string
  status: BatchJobStatus
  createdAt: string
  completedAt: string
  total: number
  processed: number
  succeeded: number
  failed: number
  results: BatchItemResultDto[]
}
