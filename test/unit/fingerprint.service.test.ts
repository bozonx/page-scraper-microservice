import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { FingerprintService } from '@/modules/scraper/services/fingerprint.service'
import { ScraperConfig } from '@/config/scraper.config'
import { FingerprintConfigDto } from '@/modules/scraper/dto/scraper-request.dto'

describe('FingerprintService', () => {
  let service: FingerprintService
  let configService: ConfigService
  let moduleRef: TestingModule

  const mockScraperConfig: ScraperConfig = {
    defaultMode: 'cheerio',
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
    batchMaxItems: 100,
    batchDataLifetimeMins: 60,
    webhookTimeoutMs: 10000,
    webhookBackoffMs: 1000,
    webhookMaxAttempts: 3,
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        FingerprintService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'scraper') {
                return mockScraperConfig
              }
              return undefined
            }),
          },
        },
      ],
    }).compile()

    service = moduleRef.get<FingerprintService>(FingerprintService)
    configService = moduleRef.get<ConfigService>(ConfigService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  describe('generateFingerprint', () => {
    it('should return empty object when generate is false', () => {
      const config: FingerprintConfigDto = {
        generate: false,
      }

      const result = service.generateFingerprint(config)

      expect(result).toEqual({})
    })

    it('should generate fingerprint with default config when no config provided', () => {
      const result = service.generateFingerprint()

      expect(result).toHaveProperty('userAgent')
      expect(result).toHaveProperty('viewport')
      expect(result).toHaveProperty('browserName')
      expect(result).toHaveProperty('platform')
      expect(result).toHaveProperty('language')
      expect(result).toHaveProperty('timezone')
      expect(result).toHaveProperty('webgl')
      expect(result).toHaveProperty('canvas')
      expect(result).toHaveProperty('audio')
      expect(result).toHaveProperty('plugins')
      expect(result).toHaveProperty('fonts')
      expect(result).toHaveProperty('screen')
      expect(result).toHaveProperty('hardware')
    })

    it('should use provided userAgent when specified', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        userAgent: 'Custom User Agent',
      }

      const result = service.generateFingerprint(config)

      expect(result.userAgent).toBe('Custom User Agent')
    })

    it('should use provided locale when specified', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        locale: 'fr-FR',
      }

      const result = service.generateFingerprint(config)

      expect(result.language).toBe('fr-FR')
    })

    it('should use provided timezone when specified', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        timezoneId: 'Europe/Paris',
      }

      const result = service.generateFingerprint(config)

      expect(result.timezone).toBe('Europe/Paris')
    })

    it('should generate random viewport dimensions', () => {
      const result = service.generateFingerprint()

      expect(result.viewport).toHaveProperty('width')
      expect(result.viewport).toHaveProperty('height')
      expect(typeof result.viewport.width).toBe('number')
      expect(typeof result.viewport.height).toBe('number')
      expect(result.viewport.width).toBeGreaterThan(0)
      expect(result.viewport.height).toBeGreaterThan(0)
    })

    it('should generate valid browser name from browsers list', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        generator: {
          browsers: ['chrome'],
        },
      }

      const result = service.generateFingerprint(config)

      expect(result.browserName).toBe('chrome')
    })

    it('should generate random platform', () => {
      const result = service.generateFingerprint()

      expect(['Win32', 'Win64', 'MacIntel', 'Linux x86_64']).toContain(result.platform)
    })

    it('should generate random language when locale is "source"', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        locale: 'source',
      }

      const result = service.generateFingerprint(config)

      expect(['en-US', 'en-GB', 'en-CA', 'en-AU', 'de-DE', 'fr-FR', 'es-ES', 'it-IT']).toContain(
        result.language
      )
    })

    it('should generate random timezone when timezoneId is "source"', () => {
      const config: FingerprintConfigDto = {
        generate: true,
        timezoneId: 'source',
      }

      const result = service.generateFingerprint(config)

      expect([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'America/Los_Angeles',
        'Europe/Paris',
        'Asia/Shanghai',
        'America/Chicago',
      ]).toContain(result.timezone)
    })

    it('should generate WebGL parameters', () => {
      const result = service.generateFingerprint()

      expect(result.webgl).toHaveProperty('vendor')
      expect(result.webgl).toHaveProperty('renderer')
      expect(result.webgl).toHaveProperty('version')
      expect(['Google Inc.', 'Mozilla', 'WebKit']).toContain(result.webgl.vendor)
    })

    it('should generate canvas parameters', () => {
      const result = service.generateFingerprint()

      expect(result.canvas).toHaveProperty('fingerprint')
      expect(result.canvas).toHaveProperty('hacked')
      expect(typeof result.canvas.fingerprint).toBe('string')
      expect(result.canvas.hacked).toBe(false)
    })

    it('should generate audio parameters', () => {
      const result = service.generateFingerprint()

      expect(result.audio).toHaveProperty('contextId')
      expect(typeof result.audio.contextId).toBe('number')
    })

    it('should generate plugins array', () => {
      const result = service.generateFingerprint()

      expect(Array.isArray(result.plugins)).toBe(true)
      expect(result.plugins.length).toBeLessThanOrEqual(2) // 0-2 plugins
      if (result.plugins.length > 0) {
        expect(['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client']).toContain(
          result.plugins[0]
        )
      }
    })

    it('should generate fonts array', () => {
      const result = service.generateFingerprint()

      expect(Array.isArray(result.fonts)).toBe(true)
      expect(result.fonts.length).toBeGreaterThanOrEqual(3) // 3-8 fonts
      expect(result.fonts.length).toBeLessThanOrEqual(8)
      // Check that fonts are from the expected list
      const commonFonts = [
        'Arial',
        'Times New Roman',
        'Helvetica',
        'Georgia',
        'Verdana',
        'Courier New',
        'Impact',
        'Comic Sans MS',
        'Trebuchet MS',
      ]
      result.fonts.forEach((font) => {
        expect(commonFonts).toContain(font)
      })
    })

    it('should generate screen parameters', () => {
      const result = service.generateFingerprint()

      expect(result.screen).toHaveProperty('width')
      expect(result.screen).toHaveProperty('height')
      expect(result.screen).toHaveProperty('colorDepth')
      expect(result.screen).toHaveProperty('pixelDepth')
      expect(result.screen.width).toBe(1920)
      expect(result.screen.height).toBe(1080)
      expect(result.screen.colorDepth).toBe(24)
      expect(result.screen.pixelDepth).toBe(24)
    })

    it('should generate hardware parameters', () => {
      const result = service.generateFingerprint()

      expect(result.hardware).toHaveProperty('cores')
      expect(result.hardware).toHaveProperty('memory')
      expect(result.hardware).toHaveProperty('deviceMemory')
      expect(result.hardware.cores).toBe(4)
      expect([2, 4, 8, 16, 32]).toContain(result.hardware.memory)
      expect([2, 4, 8, 16, 32]).toContain(result.hardware.deviceMemory)
    })
  })

  describe('shouldRotateFingerprint', () => {
    it('should return false when rotateOnAntiBot is false', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: false,
      }

      const result = service.shouldRotateFingerprint(new Error('Some error'), config)

      expect(result).toBe(false)
    })

    it('should return false when error does not contain anti-bot patterns', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('Random error'), config)

      expect(result).toBe(false)
    })

    it('should return true when error contains "captcha"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('captcha detected'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "bot detection"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('bot detection triggered'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "access denied"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('access denied'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "forbidden"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('forbidden access'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "rate limit"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('rate limit exceeded'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "security check"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('security check failed'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "cloudflare"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('cloudflare protection'), config)

      expect(result).toBe(true)
    })

    it('should return true when error contains "recaptcha"', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint(new Error('recaptcha challenge'), config)

      expect(result).toBe(true)
    })

    it('should handle non-Error objects', () => {
      const config: FingerprintConfigDto = {
        rotateOnAntiBot: true,
      }

      const result = service.shouldRotateFingerprint('Cloudflare detected', config)

      expect(result).toBe(true)
    })

    it('should use default config when no config provided', () => {
      const result = service.shouldRotateFingerprint(new Error('captcha detected'))

      expect(result).toBe(true) // Default is true from mockScraperConfig
    })
  })
})
