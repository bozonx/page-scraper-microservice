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
  @IsUrl({ require_tld: false })
  public url!: string

  /**
   * Timeout for individual scraping task in seconds (>=1)
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public taskTimeoutSecs?: number

  /**
   * Browser fingerprint configuration for avoiding detection
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FingerprintConfigDto)
  public fingerprint?: FingerprintConfigDto
}
