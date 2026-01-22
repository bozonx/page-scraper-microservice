import { HttpException } from '@nestjs/common'
import { FetchService } from '@/modules/scraper/services/fetch.service.js'

describe('FetchService (unit)', () => {
  const createService = () => {
    const configService = {
      get: jest.fn(() => ({
        playwrightNavigationTimeoutSecs: 60,
        fetchRetryMaxAttempts: 3,
        fetchMaxRedirects: 7,
        fetchMaxResponseBytes: 10 * 1024 * 1024,
        fingerprintRotateOnAntiBot: true,
      })),
    } as any

    const fingerprintService = {
      generateFingerprint: jest.fn(() => ({ headers: {}, fingerprint: { navigator: {} } })),
    } as any

    const concurrencyService = {
      run: jest.fn(async (fn: () => Promise<any>) => await fn()),
    } as any

    const browserService = {
      withPage: jest.fn(),
    } as any

    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any

    return new FetchService(
      configService,
      fingerprintService,
      concurrencyService,
      browserService,
      logger
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('returns 400 when engine is not supported', async () => {
    const service = createService()

    await expect(
      service.fetch({ url: 'https://example.com', engine: 'nope', timeoutSecs: 1 } as any)
    ).rejects.toMatchObject({
      status: 400,
    })

    try {
      await service.fetch({
        url: 'https://example.com',
        engine: 'nope',
        timeoutSecs: 1,
      } as any)
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException)
      const resp = (e as HttpException).getResponse() as any
      expect(resp.error.code).toBe('FETCH_ENGINE_NOT_SUPPORTED')
    }
  })

  it('parses Retry-After seconds to milliseconds (capped)', () => {
    const service = createService() as any
    expect(service.parseRetryAfterMs('1')).toBe(1000)
    expect(service.parseRetryAfterMs('999999')).toBe(60000)
  })

  it('parses Retry-After HTTP date to milliseconds (capped)', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const service = createService() as any
    expect(service.parseRetryAfterMs('Thu, 01 Jan 2026 00:00:30 GMT')).toBe(30000)

    jest.useRealTimers()
  })

  it('marks 429 as retryable and antibot and provides retryAfterMs when present', () => {
    const service = createService() as any
    const decision = service.getRetryDecision({ statusCode: 429, retryAfter: '2' })
    expect(decision.retryable).toBe(true)
    expect(decision.wasAntibot).toBe(true)
    expect(decision.rotateFingerprint).toBe(true)
    expect(decision.retryAfterMs).toBe(2000)
  })

  it('marks 403 as not retryable but antibot', () => {
    const service = createService() as any
    const decision = service.getRetryDecision({ statusCode: 403 })
    expect(decision.retryable).toBe(false)
    expect(decision.wasAntibot).toBe(true)
    expect(decision.rotateFingerprint).toBe(true)
  })

  describe('internal error mapping', () => {
    it('maps errors with debug stack correctly', () => {
      const service = createService() as any
      const testError = new Error('Test error')

      const withDebug = service.mapError(testError, { debug: true })
      const withoutDebug = service.mapError(testError, { debug: false })

      expect(withDebug).toBeDefined()
      expect(withoutDebug).toBeDefined()
    })
  })

  describe('mime-type validation', () => {
    it('validates content-type and rejects binary data', () => {
      const service = createService() as any

      expect(() => service.validateContentType('image/png')).toThrow('Unsupported content type')
      expect(() => service.validateContentType('video/mp4')).toThrow('Unsupported content type')
      expect(() => service.validateContentType('application/pdf')).toThrow(
        'Unsupported content type'
      )
      expect(() => service.validateContentType('application/octet-stream')).toThrow(
        'Unsupported content type'
      )
    })

    it('allows text content types', () => {
      const service = createService() as any

      expect(() => service.validateContentType('text/html')).not.toThrow()
      expect(() => service.validateContentType('text/plain')).not.toThrow()
      expect(() => service.validateContentType('text/xml')).not.toThrow()
      expect(() => service.validateContentType('text/html; charset=utf-8')).not.toThrow()
    })

    it('allows RSS/Atom/XML content types', () => {
      const service = createService() as any

      expect(() => service.validateContentType('application/rss+xml')).not.toThrow()
      expect(() => service.validateContentType('application/atom+xml')).not.toThrow()
      expect(() => service.validateContentType('application/xml')).not.toThrow()
      expect(() => service.validateContentType('application/json')).not.toThrow()
      expect(() => service.validateContentType('application/ld+json')).not.toThrow()
    })

    it('allows missing content-type', () => {
      const service = createService() as any

      expect(() => service.validateContentType(undefined)).not.toThrow()
      expect(() => service.validateContentType('')).not.toThrow()
    })
  })

  describe('error mapping', () => {
    it('maps invalid URL to FETCH_INVALID_REQUEST', () => {
      const service = createService() as any
      const mapped = service.mapError(new Error('Invalid URL'), { debug: false })

      expect(mapped.code).toBe('FETCH_INVALID_REQUEST')
      expect(mapped.retryable).toBe(false)
      expect(mapped.httpStatus).toBe(400)
    })

    it('maps unsupported content type to FETCH_UNSUPPORTED_CONTENT_TYPE', () => {
      const service = createService() as any
      const mapped = service.mapError(new Error('Unsupported content type: image/png'), {
        debug: false,
      })

      expect(mapped.code).toBe('FETCH_UNSUPPORTED_CONTENT_TYPE')
      expect(mapped.retryable).toBe(false)
      expect(mapped.httpStatus).toBe(400)
    })

    it('maps request aborted to FETCH_ABORTED', () => {
      const service = createService() as any
      const mapped = service.mapError(new Error('Request aborted'), { debug: false })

      expect(mapped.code).toBe('FETCH_ABORTED')
      expect(mapped.retryable).toBe(false)
      expect(mapped.httpStatus).toBe(400)
    })

    it('maps browser errors only for navigation/net errors', () => {
      const service = createService() as any

      const netError = service.mapError(new Error('net::ERR_CONNECTION_REFUSED'), { debug: false })
      expect(netError.code).toBe('FETCH_BROWSER_ERROR')

      const gotoError = service.mapError(new Error('page.goto failed'), { debug: false })
      expect(gotoError.code).toBe('FETCH_BROWSER_ERROR')

      const navError = service.mapError(new Error('navigation failed'), { debug: false })
      expect(navError.code).toBe('FETCH_BROWSER_ERROR')
    })

    it('maps generic errors to FETCH_ERROR', () => {
      const service = createService() as any
      const mapped = service.mapError(new Error('Something went wrong'), { debug: false })

      expect(mapped.code).toBe('FETCH_ERROR')
      expect(mapped.retryable).toBe(false)
      expect(mapped.httpStatus).toBe(500)
    })
  })
})
