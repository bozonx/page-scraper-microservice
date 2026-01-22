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
})
