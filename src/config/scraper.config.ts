import { registerAs } from '@nestjs/config'
import { IsString, IsBoolean, IsInt, IsIn, Min, Max, validateSync } from 'class-validator'
import { plainToClass } from 'class-transformer'

/**
 * Scraper configuration settings
 * Defines parameters for web scraping operations, browser behavior, and batch processing
 */
export class ScraperConfig {
  // Default scraper settings
  /**
   * Default scraper mode: 'extractor' for static content, 'playwright' for dynamic content
   */
  @IsIn(['extractor', 'playwright'])
  public defaultMode!: string

  /**
   * Default timeout for individual scraping tasks in seconds (>=1)
   */
  @IsInt()
  @Min(1)
  public defaultTaskTimeoutSecs!: number

  /**
   * Default user agent string ('auto' to automatically select appropriate user agent)
   */
  @IsString()
  public defaultUserAgent!: string

  /**
   * Default locale for content extraction (affects language detection and formatting)
   */
  @IsString()
  public defaultLocale!: string

  /**
   * Default timezone ID for date parsing and formatting
   */
  @IsString()
  public defaultTimezoneId!: string

  /**
   * Default locale for date parsing specifically (used for recognizing date formats)
   */
  @IsString()
  public defaultDateLocale!: string

  // Playwright settings
  /**
   * Run Playwright in headless mode (true = no browser UI, false = show browser)
   */
  @IsBoolean()
  public playwrightHeadless!: boolean

  /**
   * Navigation timeout in seconds for Playwright browser operations (>=1)
   */
  @IsInt()
  @Min(1)
  public playwrightNavigationTimeoutSecs!: number

  /**
   * Block common tracking scripts and analytics for faster page loading
   */
  @IsBoolean()
  public playwrightBlockTrackers!: boolean

  /**
   * Block heavy resources like images, videos, and fonts for faster scraping
   */
  @IsBoolean()
  public playwrightBlockHeavyResources!: boolean

  // Fingerprint settings
  /**
   * Enable browser fingerprint generation to avoid detection
   */
  @IsBoolean()
  public fingerprintGenerate!: boolean

  /**
   * Rotate fingerprints when anti-bot protection is detected
   */
  @IsBoolean()
  public fingerprintRotateOnAntiBot!: boolean

  // Batch processing settings
  /**
   * Minimum delay between requests in milliseconds to avoid rate limiting (500-30000)
   */
  @IsInt()
  @Min(500)
  @Max(30000)
  public batchMinDelayMs!: number

  /**
   * Maximum delay between requests in milliseconds (1000-60000)
   */
  @IsInt()
  @Min(1000)
  @Max(60000)
  public batchMaxDelayMs!: number

  /**
   * Number of concurrent requests to process simultaneously (1-10)
   */
  @IsInt()
  @Min(1)
  @Max(10)
  public batchConcurrency!: number

  /**
   * Time in minutes to retain batch job data in memory before cleanup (1-1440)
   */
  @IsInt()
  @Min(1)
  @Max(1440)
  public batchDataLifetimeMins!: number

  // Webhook settings
  /**
   * Timeout in milliseconds for webhook HTTP requests (1000-60000)
   * This is a global setting that cannot be overridden per webhook request
   */
  @IsInt()
  @Min(1000)
  @Max(60000)
  public webhookTimeoutMs!: number

  /**
   * Default backoff delay in milliseconds between webhook retry attempts (100-30000)
   * These are default values that can be overridden per webhook request
   */
  @IsInt()
  @Min(100)
  @Max(30000)
  public defaultWebhookBackoffMs!: number

  /**
   * Default maximum number of retry attempts for failed webhook deliveries (1-10)
   * These are default values that can be overridden per webhook request
   */
  @IsInt()
  @Min(1)
  @Max(10)
  public defaultWebhookMaxAttempts!: number
}

/**
 * Scraper configuration factory
 * Validates and provides scraper configuration from environment variables
 */
export default registerAs('scraper', (): ScraperConfig => {
  // Derive locale values with proper fallbacks
  const derivedDefaultLocale = process.env.DEFAULT_LOCALE ?? 'en-US'
  const derivedDefaultDateLocale = process.env.DEFAULT_DATE_LOCALE ?? derivedDefaultLocale

  const config = plainToClass(ScraperConfig, {
    // Default scraper settings
    defaultMode: process.env.DEFAULT_MODE ?? 'extractor',
    defaultTaskTimeoutSecs: parseInt(process.env.DEFAULT_TASK_TIMEOUT_SECS ?? '60', 10),
    defaultUserAgent: process.env.DEFAULT_USER_AGENT ?? 'auto',
    defaultLocale: derivedDefaultLocale,
    defaultTimezoneId: process.env.DEFAULT_TIMEZONE_ID ?? 'UTC',
    defaultDateLocale: derivedDefaultDateLocale,

    // Playwright settings - default to true unless explicitly set to 'false'
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    playwrightNavigationTimeoutSecs: parseInt(
      process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS ?? '30',
      10
    ),
    playwrightBlockTrackers: process.env.DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS !== 'false',
    playwrightBlockHeavyResources: process.env.DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES !== 'false',

    // Fingerprint settings - default to true unless explicitly set to 'false'
    fingerprintGenerate: process.env.DEFAULT_FINGERPRINT_GENERATE !== 'false',
    fingerprintRotateOnAntiBot: process.env.DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT !== 'false',

    // Batch processing settings
    batchMinDelayMs: parseInt(process.env.DEFAULT_BATCH_MIN_DELAY_MS ?? '1500', 10),
    batchMaxDelayMs: parseInt(process.env.DEFAULT_BATCH_MAX_DELAY_MS ?? '4000', 10),
    batchConcurrency: parseInt(process.env.DEFAULT_BATCH_CONCURRENCY ?? '1', 10),
    batchDataLifetimeMins: parseInt(process.env.BATCH_DATA_LIFETIME_MINS ?? '60', 10),

    // Webhook settings
    webhookTimeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS ?? '10000', 10),
    defaultWebhookBackoffMs: parseInt(process.env.DEFAULT_WEBHOOK_BACKOFF_MS ?? '1000', 10),
    defaultWebhookMaxAttempts: parseInt(process.env.DEFAULT_WEBHOOK_MAX_ATTEMPTS ?? '3', 10),
  })

  // Validate configuration and throw error if invalid
  const errors = validateSync(config, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    const errorMessages = errors.map((err) => Object.values(err.constraints ?? {}).join(', '))
    throw new Error(`Scraper config validation error: ${errorMessages.join('; ')}`)
  }

  return config
})