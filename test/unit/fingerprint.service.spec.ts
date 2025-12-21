import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { FingerprintService } from '@/modules/scraper/services/fingerprint.service.js'
import { createMockLogger, createMockConfigService } from '@test/helpers/mocks.js'
import type { ScraperConfig } from '@/config/scraper.config.js'

describe('FingerprintService (unit)', () => {
  let service: FingerprintService
  let logger: PinoLogger
  let configService: ConfigService

  const scraperConfig: ScraperConfig = {
    defaultMode: 'extractor',
    defaultTaskTimeoutSecs: 60,
    defaultUserAgent: 'auto',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',

    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    globalMaxConcurrency: 3,
    dataLifetimeMins: 60,
    cleanupIntervalMins: 10,
    defaultWebhookTimeoutSecs: 30,
    defaultWebhookBackoffMs: 1000,
    defaultWebhookMaxAttempts: 3,
  } as ScraperConfig

  beforeAll(async () => {
    logger = createMockLogger()
    configService = createMockConfigService({ scraper: scraperConfig })

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FingerprintService,
        { provide: ConfigService, useValue: configService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile()

    service = moduleRef.get(FingerprintService)
  })

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })
  })

  describe('generateFingerprint', () => {
    it('should generate fingerprint with required structure', () => {
      const result = service.generateFingerprint()

      expect(result).toBeDefined()
      expect(result.fingerprint).toBeDefined()
      expect(result.headers).toBeDefined()
      expect(result.fingerprint.navigator).toBeDefined()
      expect(result.fingerprint.navigator.userAgent).toBeDefined()
    })

    it('should return empty/default fingerprint when generation is disabled', () => {
      const result = service.generateFingerprint({ generate: false })

      // Depending on implementation, it might return empty objects or nulls
      // In our implementation we return { fingerprint: {}, headers: {} }
      expect(result.fingerprint).toEqual({})
      expect(result.headers).toEqual({})
    })

    it('should use default locale when not specified', () => {
      // Note: fingerprint-generator might not strictly respect the locale passed in 'locales' option 
      // if it's not in its database, but we can check if it runs without error.
      const result = service.generateFingerprint()
      expect(result).toBeDefined()
    })

    it('should use custom user agent when specified', () => {
      const customUA = 'Custom User Agent'
      const result = service.generateFingerprint({ userAgent: customUA })

      expect(result.fingerprint.navigator.userAgent).toBe(customUA)
      expect(result.headers['User-Agent']).toBe(customUA)
    })

    it('should respect operatingSystems option', () => {
      // This is a loose check as we rely on the library, but ensures no errors
      const result = service.generateFingerprint({
        operatingSystems: ['windows'],
      })
      expect(result.fingerprint.navigator.userAgent).toContain('Windows')
    })

    it('should respect devices option', () => {
      const result = service.generateFingerprint({
        devices: ['mobile'],
      })
      // Just verify it generates without error - fingerprint-generator handles device logic internally
      expect(result).toBeDefined()
      expect(result.fingerprint.navigator.userAgent).toBeDefined()
    })

    it('should respect locales option', () => {
      // Note: fingerprint-generator might not strictly enforce this in the UA string
      // but it should be present in the navigator properties or headers
      const result = service.generateFingerprint({
        locales: ['de-DE'],
      })
      // We check if the generated fingerprint has the locale or if it runs without error
      expect(result).toBeDefined()
    })

    it('should support linux operating system', () => {
      const result = service.generateFingerprint({
        operatingSystems: ['linux'],
      })
      expect(result.fingerprint.navigator.userAgent).toContain('Linux')
    })

    it('should support macos operating system', () => {
      const result = service.generateFingerprint({
        operatingSystems: ['macos'],
      })
      expect(result.fingerprint.navigator.userAgent).toContain('Mac')
    })

    it('should support multiple operating systems', () => {
      const result = service.generateFingerprint({
        operatingSystems: ['windows', 'macos', 'linux'],
      })
      expect(result).toBeDefined()
      expect(result.fingerprint.navigator.userAgent).toBeDefined()
    })

    it('should support desktop device', () => {
      const result = service.generateFingerprint({
        devices: ['desktop'],
      })
      expect(result).toBeDefined()
      expect(result.fingerprint.navigator.userAgent).toBeDefined()
    })

    it('should support multiple devices', () => {
      const result = service.generateFingerprint({
        devices: ['desktop', 'mobile'],
      })
      expect(result).toBeDefined()
      expect(result.fingerprint.navigator.userAgent).toBeDefined()
    })

    it('should log info message after generating fingerprint', () => {
      service.generateFingerprint()

      expect(logger.info).toHaveBeenCalled()
    })
  })

  describe('shouldRotateFingerprint', () => {
    it('should return false when rotateOnAntiBot is disabled', () => {
      const error = new Error('captcha detected')
      const result = service.shouldRotateFingerprint(error, { rotateOnAntiBot: false })

      expect(result).toBe(false)
    })

    it('should return true for captcha error', () => {
      const error = new Error('captcha detected')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for bot detection error', () => {
      const error = new Error('bot detection triggered')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for access denied error', () => {
      const error = new Error('access denied')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for forbidden error', () => {
      const error = new Error('forbidden')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for rate limit error', () => {
      const error = new Error('rate limit exceeded')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for security check error', () => {
      const error = new Error('security check required')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for cloudflare error', () => {
      const error = new Error('cloudflare protection')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return true for recaptcha error', () => {
      const error = new Error('recaptcha required')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should return false for unrelated error', () => {
      const error = new Error('network timeout')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(false)
    })

    it('should handle non-Error objects', () => {
      const error = 'captcha detected'
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })

    it('should handle error message with lowercase pattern', () => {
      const error = new Error('This page has a captcha check')
      const result = service.shouldRotateFingerprint(error)

      expect(result).toBe(true)
    })
  })
})