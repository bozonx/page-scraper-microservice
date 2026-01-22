import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { FingerprintGenerator } from 'fingerprint-generator'
import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { FingerprintConfigDto } from '../dto/scraper-request.dto.js'

/**
 * Service for generating realistic browser fingerprints
 * Uses fingerprint-generator to create consistent and realistic browser identities
 */
@Injectable()
export class FingerprintService {
  private generator: FingerprintGenerator

  private buildEmptyFingerprint(): BrowserFingerprintWithHeaders {
    return {
      fingerprint: {
        navigator: {
          userAgent: '',
          language: '',
        },
      } as any,
      headers: {},
    }
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(FingerprintService.name)
    this.generator = new FingerprintGenerator()
  }

  /**
   * Generates a realistic browser fingerprint
   * @param config Optional fingerprint configuration overrides
   * @returns Generated browser fingerprint with headers
   */
  generateFingerprint(
    config?: FingerprintConfigDto
  ): BrowserFingerprintWithHeaders & { timezone?: string } {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Use provided config or defaults
    const fingerprintConfig = config || {}
    const generate = fingerprintConfig.generate ?? scraperConfig.fingerprintGenerate

    if (!generate) {
      return this.buildEmptyFingerprint()
    }

    const generatorOptions: any = {
      browsers: [{ name: 'chrome' }],
      operatingSystems: fingerprintConfig.operatingSystems || ['windows'],
      devices: fingerprintConfig.devices || ['desktop'],
    }

    // If specific user agent is requested, we can't easily force it in fingerprint-generator
    // without breaking consistency.
    // However, the previous implementation allowed overriding UA.
    // If UA is provided, we might just want to override it in the headers result.

    try {
      const fingerprint = this.generator.getFingerprint(generatorOptions)

      // Handle User-Agent
      if (!fingerprintConfig.userAgent) {
        // undefined → use default from env
        fingerprint.fingerprint.navigator.userAgent =
          scraperConfig.defaultUserAgent === 'auto'
            ? fingerprint.fingerprint.navigator.userAgent
            : scraperConfig.defaultUserAgent
        fingerprint.headers['User-Agent'] = fingerprint.fingerprint.navigator.userAgent
      } else if (fingerprintConfig.userAgent === 'auto') {
        // 'auto' → use what fingerprint-generator created (already set)
        // No action needed
      } else {
        // custom value → override
        fingerprint.fingerprint.navigator.userAgent = fingerprintConfig.userAgent
        fingerprint.headers['User-Agent'] = fingerprintConfig.userAgent
      }

      // Handle locale
      if (!fingerprintConfig.locale) {
        // undefined → use default from env
        fingerprint.fingerprint.navigator.language = scraperConfig.defaultLocale
        fingerprint.headers['Accept-Language'] = scraperConfig.defaultLocale
      } else if (fingerprintConfig.locale === 'auto') {
        // 'auto' → use what fingerprint-generator created (already set)
        // No action needed
      } else {
        // custom value → override
        fingerprint.fingerprint.navigator.language = fingerprintConfig.locale
        fingerprint.headers['Accept-Language'] = fingerprintConfig.locale
      }

      this.logger.debug(`Generated fingerprint: ${fingerprint.fingerprint.navigator.userAgent}`)

      // Handle timezone (no 'auto' support since library doesn't generate it)
      const timezone = fingerprintConfig.timezoneId || scraperConfig.defaultTimezoneId
      if (timezone) {
        return { ...fingerprint, timezone }
      }

      return fingerprint
    } catch (error) {
      this.logger.error('Failed to generate fingerprint', error)
      // Fallback to a safe default
      return this.generator.getFingerprint() as any
    }
  }

  /**
   * Determines if fingerprint should be rotated based on error content
   * @param error The error that occurred during scraping
   * @param config Fingerprint configuration
   * @returns Whether to rotate fingerprint and retry
   */
  shouldRotateFingerprint(error: any, config?: FingerprintConfigDto): boolean {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const rotateOnAntiBot = config?.rotateOnAntiBot ?? scraperConfig.fingerprintRotateOnAntiBot

    if (!rotateOnAntiBot) {
      return false
    }

    // Check for anti-bot detection patterns
    const antiBotPatterns = [
      'captcha',
      'bot detection',
      'access denied',
      'forbidden',
      'rate limit',
      'security check',
      'cloudflare',
      'recaptcha',
    ]

    const errorMessage = error instanceof Error ? error.message : String(error).toLowerCase()

    return antiBotPatterns.some((pattern) => errorMessage.includes(pattern))
  }
}
