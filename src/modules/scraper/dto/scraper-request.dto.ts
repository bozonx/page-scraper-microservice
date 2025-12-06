import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  Min,
  IsObject,
  IsArray,
  ValidateNested,
  IsUrl,
} from 'class-validator'
import { Type } from 'class-transformer'

/**
 * Fingerprint configuration for browser simulation
 * Defines parameters for generating realistic browser fingerprints
 */
export class FingerprintConfigDto {
  /**
   * Whether to generate a browser fingerprint
   */
  @IsOptional()
  @IsBoolean()
  public generate?: boolean

  /**
   * Custom user agent string (overrides auto-generation)
   */
  @IsOptional()
  @IsString()
  public userAgent?: string

  /**
   * Browser locale for content extraction
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
   * Whether to rotate fingerprint when anti-bot protection is detected
   */
  @IsOptional()
  @IsBoolean()
  public rotateOnAntiBot?: boolean

  /**
   * List of browsers to simulate (e.g., ['chrome', 'firefox'])
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public browsers?: string[]

  /**
   * List of operating systems to simulate (e.g., ['windows', 'macos', 'linux'])
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public operatingSystems?: string[]

  /**
   * List of device types to simulate (e.g., ['desktop', 'mobile'])
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public devices?: string[]

  /**
   * List of locales to simulate (e.g., ['en-US', 'de-DE'])
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public locales?: string[]
}

/**
 * Scraper request DTO
 * Defines parameters for web scraping operations
 */
export class ScraperRequestDto {
  /**
   * URL to scrape content from
   */
  @IsUrl({ require_tld: false })
  public url!: string

  /**
   * Scraper mode: 'extractor' for static content, 'playwright' for dynamic content
   */
  @IsOptional()
  @IsIn(['extractor', 'playwright'])
  public mode?: string

  /**
   * Timeout for individual scraping task in seconds (>=1)
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
