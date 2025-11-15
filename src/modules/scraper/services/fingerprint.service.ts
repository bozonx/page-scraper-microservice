import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ScraperConfig } from '@config/scraper.config'
import { FingerprintConfigDto } from '../dto/scraper-request.dto'

@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name)

  constructor(private readonly configService: ConfigService) {}

  generateFingerprint(config?: FingerprintConfigDto): any {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    // Use provided config or defaults
    const fingerprintConfig = config || {}
    const generate = fingerprintConfig.generate ?? scraperConfig.fingerprintGenerate

    if (!generate) {
      return {}
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
    const fingerprint = {
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

    this.logger.log(`Generated fingerprint for browser: ${selectedBrowser}`)
    return fingerprint
  }

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

  private generatePlatform(): string {
    const platforms = ['Win32', 'Win64', 'MacIntel', 'Linux x86_64']
    return platforms[Math.floor(Math.random() * platforms.length)]
  }

  private generateLanguage(locale: string): string {
    if (locale === 'source') {
      const languages = ['en-US', 'en-GB', 'en-CA', 'en-AU', 'de-DE', 'fr-FR', 'es-ES', 'it-IT']
      return languages[Math.floor(Math.random() * languages.length)]
    }

    return locale
  }

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

  private generateWebGLParams(): any {
    return {
      vendor: this.generateRandomVendor(['Google Inc.', 'Mozilla', 'WebKit']),
      renderer: this.generateRandomRenderer([
        'ANGLE (Intel, Intel(R) HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        'WebKit WebGL',
      ]),
      version: this.generateRandomVersion(['WebGL 1.0', 'WebGL 2.0']),
    }
  }

  private generateCanvasParams(): any {
    return {
      fingerprint: Math.random().toString(36).substring(2, 15),
      hacked: false,
    }
  }

  private generateAudioParams(): any {
    return {
      contextId: Math.floor(Math.random() * 100),
    }
  }

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

    // Randomly select 3-8 fonts
    const numFonts = Math.floor(Math.random() * 6) + 3
    const selectedFonts: string[] = []

    for (let i = 0; i < numFonts; i++) {
      const font = commonFonts[Math.floor(Math.random() * commonFonts.length)]
      if (!selectedFonts.includes(font)) {
        selectedFonts.push(font)
      }
    }

    return selectedFonts
  }

  private generateScreenParams(): any {
    return {
      width: window.screen?.width || 1920,
      height: window.screen?.height || 1080,
      colorDepth: 24,
      pixelDepth: 24,
    }
  }

  private generateHardwareParams(): any {
    return {
      cores: navigator.hardwareConcurrency || 4,
      memory: this.generateRandomMemory(),
      deviceMemory: this.generateRandomMemory(),
    }
  }

  private generateRandomVendor(vendors: string[]): string {
    return vendors[Math.floor(Math.random() * vendors.length)]
  }

  private generateRandomRenderer(renderers: string[]): string {
    return renderers[Math.floor(Math.random() * renderers.length)]
  }

  private generateRandomVersion(versions: string[]): string {
    return versions[Math.floor(Math.random() * versions.length)]
  }

  private generateRandomMemory(): number {
    const memoryOptions = [2, 4, 8, 16, 32] // GB
    return memoryOptions[Math.floor(Math.random() * memoryOptions.length)]
  }
}
