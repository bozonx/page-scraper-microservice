import { registerAs } from '@nestjs/config'
import { IsString, IsBoolean, IsInt, IsIn, Min, Max, validateSync } from 'class-validator'
import { plainToClass } from 'class-transformer'

/**
 * Scraper configuration settings
 * Defines parameters for web scraping operations and browser behavior
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

  // Fetch (/fetch) settings
  /**
   * Maximum number of retry attempts for /fetch operations (>=1)
   */
  @IsInt()
  @Min(1)
  public fetchRetryMaxAttempts!: number

  /**
   * Maximum number of redirects to follow for /fetch engine=http (0-20)
   */
  @IsInt()
  @Min(0)
  @Max(20)
  public fetchMaxRedirects!: number

  /**
   * Maximum response size in bytes for /fetch engine=http (>=1)
   */
  @IsInt()
  @Min(1)
  public fetchMaxResponseBytes!: number

  // File proxy (/file) settings
  /**
   * Maximum number of redirects to follow for /file engine=http (0-20)
   */
  @IsInt()
  @Min(0)
  @Max(20)
  public fileMaxRedirects!: number

  /**
   * Maximum response size in bytes for /file (>=1)
   */
  @IsInt()
  @Min(1)
  public fileMaxResponseBytes!: number

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

  /**
   * Extra Chromium launch args for Playwright. Can be a JSON array string or a space-separated list.
   */
  @IsString()
  public playwrightExtraArgs!: string

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

  /**
   * Maximum number of heavy scraping tasks running concurrently across the entire service (>=1)
   */
  @IsInt()
  @Min(1)
  public globalMaxConcurrency!: number

  /**
   * Maximum number of queued heavy tasks waiting for execution (>=0)
   * 0 disables queueing (only immediate execution is allowed)
   */
  @IsInt()
  @Min(0)
  public globalMaxQueue!: number

  /**
   * Maximum number of Playwright browser tasks running concurrently across the entire service (>=1)
   */
  @IsInt()
  @Min(1)
  public browserMaxConcurrency!: number

  /**
   * Maximum number of queued Playwright tasks waiting for execution (>=0)
   * 0 disables queueing (only immediate execution is allowed)
   */
  @IsInt()
  @Min(0)
  public browserMaxQueue!: number
}

/**
 * Scraper configuration factory
 * Validates and provides scraper configuration from environment variables
 */
export default registerAs('scraper', (): ScraperConfig => {
  const config = plainToClass(ScraperConfig, {
    // Default scraper settings
    defaultMode: process.env.DEFAULT_MODE ?? 'extractor',
    defaultTaskTimeoutSecs: parseInt(process.env.DEFAULT_TASK_TIMEOUT_SECS ?? '60', 10),
    defaultUserAgent: process.env.DEFAULT_FINGERPRINT_USER_AGENT || 'auto',
    defaultLocale: process.env.DEFAULT_FINGERPRINT_LOCALE || 'en-US',
    defaultTimezoneId: process.env.DEFAULT_FINGERPRINT_TIMEZONE_ID || 'UTC',

    // Fetch (/fetch) settings
    fetchRetryMaxAttempts: parseInt(process.env.FETCH_RETRY_MAX_ATTEMPTS ?? '3', 10),
    fetchMaxRedirects: parseInt(process.env.FETCH_MAX_REDIRECTS ?? '7', 10),
    fetchMaxResponseBytes: parseInt(
      process.env.FETCH_MAX_RESPONSE_BYTES ?? String(10 * 1024 * 1024),
      10
    ),

    // File proxy (/file) settings
    fileMaxRedirects: parseInt(process.env.FILE_MAX_REDIRECTS ?? '7', 10),
    fileMaxResponseBytes: parseInt(
      process.env.FILE_MAX_RESPONSE_BYTES ?? String(25 * 1024 * 1024),
      10
    ),

    // Playwright settings - default to true unless explicitly set to 'false'
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    playwrightNavigationTimeoutSecs: parseInt(
      process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS ?? '30',
      10
    ),
    playwrightBlockTrackers: process.env.DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS !== 'false',
    playwrightBlockHeavyResources: process.env.DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES !== 'false',
    playwrightExtraArgs: process.env.PLAYWRIGHT_EXTRA_ARGS ?? '[]',

    // Fingerprint settings - default to true unless explicitly set to 'false'
    fingerprintGenerate: process.env.DEFAULT_FINGERPRINT_GENERATE !== 'false',
    fingerprintRotateOnAntiBot: process.env.DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT !== 'false',

    // Concurrency and cleanup settings
    globalMaxConcurrency: parseInt(process.env.MAX_CONCURRENCY ?? '3', 10),
    browserMaxConcurrency: parseInt(process.env.MAX_BROWSER_CONCURRENCY ?? '1', 10),

    // Queue limits
    globalMaxQueue: parseInt(process.env.MAX_QUEUE ?? '100', 10),
    browserMaxQueue: parseInt(process.env.MAX_BROWSER_QUEUE ?? '50', 10),
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
