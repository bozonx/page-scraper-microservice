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
   * Default locale for browser fingerprint generation (e.g. "en-US", "ru-RU")
   */
  @IsString()
  public defaultLocale!: string

  /**
   * Default timezone ID for browser fingerprint (e.g. "UTC", "Europe/Moscow")
   */
  @IsString()
  public defaultTimezoneId!: string

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
   * Minimum delay between requests in milliseconds to avoid rate limiting (500-3600000)
   */
  @IsInt()
  @Min(500)
  @Max(3600000)
  public batchMinDelayMs!: number

  /**
   * Maximum delay between requests in milliseconds (1000-3600000)
   */
  @IsInt()
  @Min(1000)
  @Max(3600000)
  public batchMaxDelayMs!: number

  /**
   * Maximum number of heavy scraping tasks running concurrently across the entire service (>=1)
   */
  @IsInt()
  @Min(1)
  public globalMaxConcurrency!: number

  /**
   * Time in minutes to retain batch job data in memory before cleanup (1-44640)
   */
  @IsInt()
  @Min(1)
  @Max(44640)
  public dataLifetimeMins!: number

  /**
   * Minimum interval in minutes between cleanup runs (1-10080)
   */
  @IsInt()
  @Min(1)
  @Max(10080)
  public cleanupIntervalMins!: number

  // Webhook settings
  /**
   * Timeout in milliseconds for webhook HTTP requests (1000-600000)
   * This is a global setting that cannot be overridden per webhook request
   */
  @IsInt()
  @Min(1000)
  @Max(600000)
  public webhookTimeoutMs!: number

  /**
   * Default backoff delay in milliseconds between webhook retry attempts (100-600000)
   * These are default values that can be overridden per webhook request
   */
  @IsInt()
  @Min(100)
  @Max(600000)
  public defaultWebhookBackoffMs!: number

  /**
   * Default maximum number of retry attempts for failed webhook deliveries (1-100)
   * These are default values that can be overridden per webhook request
   */
  @IsInt()
  @Min(1)
  @Max(100)
  public defaultWebhookMaxAttempts!: number
}

/**
 * Scraper configuration factory
 * Validates and provides scraper configuration from environment variables
 */
export default registerAs('scraper', (): ScraperConfig => {
  // Support both new (with FINGERPRINT prefix) and legacy environment variable names
  // for backward compatibility
  const derivedDefaultLocale =
    process.env.DEFAULT_FINGERPRINT_LOCALE || process.env.DEFAULT_LOCALE || 'en-US'

  const config = plainToClass(ScraperConfig, {
    // Default scraper settings
    defaultMode: process.env.DEFAULT_MODE ?? 'extractor',
    defaultTaskTimeoutSecs: parseInt(process.env.DEFAULT_TASK_TIMEOUT_SECS ?? '60', 10),
    // Support both new and legacy variable names
    defaultUserAgent:
      process.env.DEFAULT_FINGERPRINT_USER_AGENT || process.env.DEFAULT_USER_AGENT || 'auto',
    defaultLocale: derivedDefaultLocale,
    defaultTimezoneId:
      process.env.DEFAULT_FINGERPRINT_TIMEZONE_ID || process.env.DEFAULT_TIMEZONE_ID || 'UTC',

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
    globalMaxConcurrency: parseInt(process.env.MAX_CONCURRENCY ?? '3', 10),
    dataLifetimeMins: parseInt(process.env.DATA_LIFETIME_MINS ?? '60', 10),
    cleanupIntervalMins: parseInt(process.env.CLEANUP_INTERVAL_MINS ?? '10', 10),

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
