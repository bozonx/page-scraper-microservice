import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { FingerprintConfigDto } from '../dto/scraper-request.dto.js'

/**
 * Browser fingerprint interface
 * Defines the structure of generated browser fingerprints
 */
export interface BrowserFingerprint {
  /**
   * Browser user agent string
   */
  userAgent: string

  /**
   * Browser viewport dimensions
   */
  viewport: { width: number; height: number }

  /**
   * Browser name (e.g., 'chrome', 'firefox')
   */
  browserName: string

  /**
   * Operating system platform
   */
  platform: string

  /**
   * Browser language setting
   */
  language: string

  /**
   * Browser timezone setting
   */
  timezone: string

  /**
   * WebGL rendering parameters
   */
  webgl: {
    vendor: string
    renderer: string
    version: string
  }

  /**
   * Canvas fingerprint parameters
   */
  canvas: {
    fingerprint: string
    hacked: boolean
  }

  /**
   * Audio context parameters
   */
  audio: {
    contextId: number
  }

  /**
   * List of browser plugins
   */
  plugins: string[]

  /**
   * List of available fonts
   */
  fonts: string[]

  /**
   * Screen parameters
   */
  screen: {
    width: number
    height: number
    colorDepth: number
    pixelDepth: number
  }

  /**
   * Hardware parameters
   */
  hardware: {
    cores: number
    memory: number
    deviceMemory: number
  }
}

/**
 * Service for generating realistic browser fingerprints
 * Helps avoid detection by anti-bot systems
 */
@Injectable()
export class FingerprintService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(FingerprintService.name)
  }

  /**
   * Generates a realistic browser fingerprint
   * @param config Optional fingerprint configuration overrides
   * @returns Generated browser fingerprint
   */
  generateFingerprint(config?: FingerprintConfigDto): BrowserFingerprint {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Use provided config or defaults
    const fingerprintConfig = config || {}
    const generate = fingerprintConfig.generate ?? scraperConfig.fingerprintGenerate

    // Return empty fingerprint if generation is disabled
    if (!generate) {
      return {} as BrowserFingerprint
    }

    const browsers = fingerprintConfig.generator?.browsers || ['chrome']
    const selectedBrowser = browsers[Math.floor(Math.random() * browsers.length)]

    // Generate realistic user agent
    const userAgent = this.generateUserAgent(
      fingerprintConfig.userAgent || scraperConfig.defaultUserAgent,
      selectedBrowser
    )

    // Generate viewport
    const viewport = this.generateViewport()

    // Generate other browser characteristics
    const fingerprint: BrowserFingerprint = {
      userAgent,
      viewport,
      browserName: selectedBrowser,
      platform: this.generatePlatform(),
      language: this.generateLanguage(fingerprintConfig.locale || scraperConfig.defaultLocale),
      timezone: this.generateTimezone(
        fingerprintConfig.timezoneId || scraperConfig.defaultTimezoneId
      ),
      webgl: this.generateWebGLParams(),
      canvas: this.generateCanvasParams(),
      audio: this.generateAudioParams(),
      plugins: this.generatePlugins(),
      fonts: this.generateFonts(),
      screen: this.generateScreenParams(),
      hardware: this.generateHardwareParams(),
    }

    this.logger.info(`Generated fingerprint for browser: ${selectedBrowser}`)
    return fingerprint
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

  /**
   * Generates a realistic user agent string
   * @param config User agent configuration ('auto' or custom string)
   * @param browser Browser type to generate agent for
   * @returns Generated user agent string
   */
  private generateUserAgent(config: string, browser: string): string {
    if (config === 'auto') {
      // Generate realistic user agent based on browser
      const versions = {
        chrome: [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ],
      }

      const browserVersions = versions[browser as keyof typeof versions] || versions.chrome
      return browserVersions[Math.floor(Math.random() * browserVersions.length)]
    }

    return config
  }

  /**
   * Generates realistic viewport dimensions
   * @returns Viewport object with width and height
   */
  private generateViewport(): { width: number; height: number } {
    const commonResolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1280, height: 720 },
    ]

    return commonResolutions[Math.floor(Math.random() * commonResolutions.length)]
  }

  /**
   * Generates a realistic platform string
   * @returns Platform string
   */
  private generatePlatform(): string {
    const platforms = ['Win32', 'Win64', 'MacIntel', 'Linux x86_64']
    return platforms[Math.floor(Math.random() * platforms.length)]
  }

  /**
   * Generates a realistic language string
   * @param locale Locale configuration ('source' or specific locale)
   * @returns Language string
   */
  private generateLanguage(locale: string): string {
    if (locale === 'source') {
      const languages = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'de-DE', 'fr-FR', 'es-ES', 'it-IT']
      return languages[Math.floor(Math.random() * languages.length)]
    }

    return locale
  }

  /**
   * Generates a realistic timezone string
   * @param timezone Timezone configuration ('source' or specific timezone)
   * @returns Timezone string
   */
  private generateTimezone(timezone: string): string {
    if (timezone === 'source') {
      const commonTimezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'America/Los_Angeles',
        'Europe/Paris',
        'Asia/Shanghai',
        'America/Chicago',
      ]
      return commonTimezones[Math.floor(Math.random() * commonTimezones.length)]
    }

    return timezone
  }

  /**
   * Generates WebGL parameters
   * @returns WebGL parameters object
   */
  private generateWebGLParams(): BrowserFingerprint['webgl'] {
    return {
      vendor: this.generateRandomVendor(['Google Inc.', 'Mozilla', 'WebKit']),
      renderer: this.generateRandomRenderer([
        'ANGLE (Intel, Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'WebKit WebGL',
      ]),
      version: this.generateRandomVersion(['WebGL 1.0', 'WebGL 2.0']),
    }
  }

  /**
   * Generates canvas fingerprint parameters
   * @returns Canvas parameters object
   */
  private generateCanvasParams(): BrowserFingerprint['canvas'] {
    return {
      fingerprint: Math.random().toString(36).substring(2, 15),
      hacked: false,
    }
  }

  /**
   * Generates audio context parameters
   * @returns Audio parameters object
   */
  private generateAudioParams(): BrowserFingerprint['audio'] {
    return {
      contextId: Math.floor(Math.random() * 100),
    }
  }

  /**
   * Generates a list of browser plugins
   * @returns Array of plugin names
   */
  private generatePlugins(): string[] {
    const commonPlugins = ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client']

    // Randomly select 0-2 plugins
    const numPlugins = Math.floor(Math.random() * 3)
    const selectedPlugins: string[] = []

    for (let i = 0; i < numPlugins; i++) {
      const plugin = commonPlugins[Math.floor(Math.random() * commonPlugins.length)]
      if (!selectedPlugins.includes(plugin)) {
        selectedPlugins.push(plugin)
      }
    }

    return selectedPlugins
  }

  /**
   * Generates a list of available fonts
   * @returns Array of font names
   */
  private generateFonts(): string[] {
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

    // Randomly select 3-8 unique fonts
    const numFonts = Math.floor(Math.random() * 6) + 3
    const shuffled = [...commonFonts]
    // Fisher–Yates shuffle for unbiased sampling
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, numFonts)
  }

  /**
   * Generates screen parameters
   * @returns Screen parameters object
   */
  private generateScreenParams(): BrowserFingerprint['screen'] {
    return {
      width: 1920,
      height: 1080,
      colorDepth: 24,
      pixelDepth: 24,
    }
  }

  /**
   * Generates hardware parameters
   * @returns Hardware parameters object
   */
  private generateHardwareParams(): BrowserFingerprint['hardware'] {
    return {
      cores: 4,
      memory: this.generateRandomMemory(),
      deviceMemory: this.generateRandomMemory(),
    }
  }

  /**
   * Selects a random vendor from provided list
   * @param vendors Array of vendor names
   * @returns Selected vendor name
   */
  private generateRandomVendor(vendors: string[]): string {
    return vendors[Math.floor(Math.random() * vendors.length)]
  }

  /**
   * Selects a random renderer from provided list
   * @param renderers Array of renderer names
   * @returns Selected renderer name
   */
  private generateRandomRenderer(renderers: string[]): string {
    return renderers[Math.floor(Math.random() * renderers.length)]
  }

  /**
   * Selects a random version from provided list
   * @param versions Array of version strings
   * @returns Selected version string
   */
  private generateRandomVersion(versions: string[]): string {
    return versions[Math.floor(Math.random() * versions.length)]
  }

  /**
   * Generates a random memory amount in GB
   * @returns Memory amount in GB
   */
  private generateRandomMemory(): number {
    const memoryOptions = [2, 4, 8, 16, 32] // GB
    return memoryOptions[Math.floor(Math.random() * memoryOptions.length)]
  }
}
