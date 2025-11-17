import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  IsObject,
  ValidateNested,
  IsUrl,
} from 'class-validator'
import { Type } from 'class-transformer'
import { FingerprintConfigDto } from './scraper-request.dto.js'

/**
 * HTML request DTO
 * Defines parameters for raw HTML retrieval using Playwright only
 */
export class HtmlRequestDto {
  /**
   * URL to retrieve HTML from
   */
  @IsUrl()
  public url!: string

  /**
   * Timeout for individual scraping task in seconds (>=1)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public taskTimeoutSecs?: number

  /**
   * Locale for content extraction (affects language detection and formatting)
   */
  @IsOptional()
  @IsString()
  public locale?: string

  /**
   * Timezone ID for date parsing and formatting
   */
  @IsOptional()
  @IsString()
  public timezoneId?: string

  /**
   * Block common tracking scripts and analytics for faster page loading
   */
  @IsOptional()
  @IsBoolean()
  public blockTrackers?: boolean

  /**
   * Block heavy resources like images, videos, and fonts for faster scraping
   */
  @IsOptional()
  @IsBoolean()
  public blockHeavyResources?: boolean

  /**
   * Browser fingerprint configuration for avoiding detection
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto
}
