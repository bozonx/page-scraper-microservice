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
    defaultTaskTimeoutSecs: 30,
    defaultUserAgent: 'auto',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',
    defaultDateLocale: 'en',
    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    batchConcurrency: 1,
    batchDataLifetimeMins: 60,
    webhookTimeoutMs: 10000,
    webhookBackoffMs: 1000,
    webhookMaxAttempts: 3,
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
    it('should generate fingerprint with all required fields', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint).toBeDefined()
      expect(fingerprint.userAgent).toBeDefined()
      expect(fingerprint.viewport).toBeDefined()
      expect(fingerprint.browserName).toBeDefined()
      expect(fingerprint.platform).toBeDefined()
      expect(fingerprint.language).toBeDefined()
      expect(fingerprint.timezone).toBeDefined()
      expect(fingerprint.webgl).toBeDefined()
      expect(fingerprint.canvas).toBeDefined()
      expect(fingerprint.audio).toBeDefined()
      expect(fingerprint.plugins).toBeDefined()
      expect(fingerprint.fonts).toBeDefined()
      expect(fingerprint.screen).toBeDefined()
      expect(fingerprint.hardware).toBeDefined()
    })

    it('should return empty fingerprint when generation is disabled', () => {
      const fingerprint = service.generateFingerprint({ generate: false })

      expect(fingerprint).toEqual({})
    })

    it('should use default locale when not specified', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.language).toBe('en-US')
    })

    it('should use custom locale when specified', () => {
      const fingerprint = service.generateFingerprint({ locale: 'de-DE' })

      expect(fingerprint.language).toBe('de-DE')
    })

    it('should generate random locale when locale is "source"', () => {
      const fingerprint = service.generateFingerprint({ locale: 'source' })

      expect(fingerprint.language).toBeDefined()
      expect(typeof fingerprint.language).toBe('string')
    })

    it('should use default timezone when not specified', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.timezone).toBe('UTC')
    })

    it('should use custom timezone when specified', () => {
      const fingerprint = service.generateFingerprint({ timezoneId: 'America/New_York' })

      expect(fingerprint.timezone).toBe('America/New_York')
    })

    it('should generate random timezone when timezone is "source"', () => {
      const fingerprint = service.generateFingerprint({ timezoneId: 'source' })

      expect(fingerprint.timezone).toBeDefined()
      expect(typeof fingerprint.timezone).toBe('string')
    })

    it('should generate auto user agent when userAgent is "auto"', () => {
      const fingerprint = service.generateFingerprint({ userAgent: 'auto' })

      expect(fingerprint.userAgent).toBeDefined()
      expect(fingerprint.userAgent).toContain('Mozilla')
    })

    it('should use custom user agent when specified', () => {
      const customUA = 'Custom User Agent'
      const fingerprint = service.generateFingerprint({ userAgent: customUA })

      expect(fingerprint.userAgent).toBe(customUA)
    })

    it('should select browser from provided list', () => {
      const fingerprint = service.generateFingerprint({
        generator: { browsers: ['chrome'] },
      })

      expect(fingerprint.browserName).toBe('chrome')
    })

    it('should generate viewport with valid dimensions', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.viewport.width).toBeGreaterThan(0)
      expect(fingerprint.viewport.height).toBeGreaterThan(0)
    })

    it('should generate WebGL params with required fields', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.webgl.vendor).toBeDefined()
      expect(fingerprint.webgl.renderer).toBeDefined()
      expect(fingerprint.webgl.version).toBeDefined()
    })

    it('should generate canvas params with fingerprint and hacked flag', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.canvas.fingerprint).toBeDefined()
      expect(typeof fingerprint.canvas.fingerprint).toBe('string')
      expect(fingerprint.canvas.hacked).toBe(false)
    })

    it('should generate audio params with contextId', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.audio.contextId).toBeDefined()
      expect(typeof fingerprint.audio.contextId).toBe('number')
    })

    it('should generate plugins array', () => {
      const fingerprint = service.generateFingerprint()

      expect(Array.isArray(fingerprint.plugins)).toBe(true)
    })

    it('should generate fonts array with multiple fonts', () => {
      const fingerprint = service.generateFingerprint()

      expect(Array.isArray(fingerprint.fonts)).toBe(true)
      expect(fingerprint.fonts.length).toBeGreaterThanOrEqual(3)
      expect(fingerprint.fonts.length).toBeLessThanOrEqual(9)
    })

    it('should generate screen params with valid values', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.screen.width).toBeGreaterThan(0)
      expect(fingerprint.screen.height).toBeGreaterThan(0)
      expect(fingerprint.screen.colorDepth).toBeGreaterThan(0)
      expect(fingerprint.screen.pixelDepth).toBeGreaterThan(0)
    })

    it('should generate hardware params with valid values', () => {
      const fingerprint = service.generateFingerprint()

      expect(fingerprint.hardware.cores).toBeGreaterThan(0)
      expect(fingerprint.hardware.memory).toBeGreaterThan(0)
      expect(fingerprint.hardware.deviceMemory).toBeGreaterThan(0)
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
