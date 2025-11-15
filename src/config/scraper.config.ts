import { registerAs } from '@nestjs/config'
import { IsString, IsBoolean, IsInt, IsIn, Min, Max, validateSync } from 'class-validator'
import { plainToClass } from 'class-transformer'

export class ScraperConfig {
  // Default scraper settings
  @IsIn(['cheerio', 'playwright'])
  public defaultMode!: string

  @IsInt()
  @Min(1)
  @Max(300)
  public defaultTaskTimeoutSecs!: number

  @IsString()
  public defaultUserAgent!: string

  @IsString()
  public defaultLocale!: string

  @IsString()
  public defaultTimezoneId!: string

  @IsString()
  public defaultDateLocale!: string

  // Playwright settings
  @IsBoolean()
  public playwrightHeadless!: boolean

  @IsInt()
  @Min(1)
  @Max(300)
  public playwrightNavigationTimeoutSecs!: number

  @IsBoolean()
  public playwrightBlockTrackers!: boolean

  @IsBoolean()
  public playwrightBlockHeavyResources!: boolean

  // Fingerprint settings
  @IsBoolean()
  public fingerprintGenerate!: boolean

  @IsBoolean()
  public fingerprintRotateOnAntiBot!: boolean

  // Batch processing settings
  @IsInt()
  @Min(500)
  @Max(30000)
  public batchMinDelayMs!: number

  @IsInt()
  @Min(1000)
  @Max(60000)
  public batchMaxDelayMs!: number

  @IsInt()
  @Min(1)
  @Max(10)
  public batchConcurrency!: number

  @IsInt()
  @Min(1)
  @Max(1000)
  public batchMaxItems!: number

  @IsInt()
  @Min(1)
  @Max(1440)
  public batchDataLifetimeMins!: number

  // Webhook settings
  @IsInt()
  @Min(1000)
  @Max(60000)
  public webhookTimeoutMs!: number

  @IsInt()
  @Min(100)
  @Max(30000)
  public webhookBackoffMs!: number

  @IsInt()
  @Min(1)
  @Max(10)
  public webhookMaxAttempts!: number
}

export default registerAs('scraper', (): ScraperConfig => {
  const config = plainToClass(ScraperConfig, {
    // Default scraper settings
    defaultMode: process.env.DEFAULT_MODE ?? 'cheerio',
    defaultTaskTimeoutSecs: parseInt(process.env.DEFAULT_TASK_TIMEOUT_SECS ?? '30', 10),
    defaultUserAgent: process.env.DEFAULT_USER_AGENT ?? 'auto',
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'en-US',
    defaultTimezoneId: process.env.DEFAULT_TIMEZONE_ID ?? 'UTC',
    defaultDateLocale: process.env.DEFAULT_DATE_LOCALE ?? 'en',

    // Playwright settings
    playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    playwrightNavigationTimeoutSecs: parseInt(
      process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS ?? '30',
      10
    ),
    playwrightBlockTrackers: process.env.PLAYWRIGHT_BLOCK_TRACKERS !== 'false',
    playwrightBlockHeavyResources: process.env.PLAYWRIGHT_BLOCK_HEAVY_RESOURCES !== 'false',

    // Fingerprint settings
    fingerprintGenerate: process.env.FINGERPRINT_GENERATE !== 'false',
    fingerprintRotateOnAntiBot: process.env.FINGERPRINT_ROTATE_ON_ANTI_BOT !== 'false',

    // Batch processing settings
    batchMinDelayMs: parseInt(process.env.BATCH_MIN_DELAY_MS ?? '1500', 10),
    batchMaxDelayMs: parseInt(process.env.BATCH_MAX_DELAY_MS ?? '4000', 10),
    batchConcurrency: parseInt(process.env.BATCH_CONCURRENCY ?? '1', 10),
    batchMaxItems: parseInt(process.env.BATCH_MAX_ITEMS ?? '100', 10),
    batchDataLifetimeMins: parseInt(process.env.BATCH_DATA_LIFETIME_MINS ?? '60', 10),

    // Webhook settings
    webhookTimeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS ?? '10000', 10),
    webhookBackoffMs: parseInt(process.env.WEBHOOK_BACKOFF_MS ?? '1000', 10),
    webhookMaxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS ?? '3', 10),
  })

  const errors = validateSync(config, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    const errorMessages = errors.map((err) => Object.values(err.constraints ?? {}).join(', '))
    throw new Error(`Scraper config validation error: ${errorMessages.join('; ')}`)
  }

  return config
})
