import { HttpException } from '@nestjs/common'
import { FetchService } from '@/modules/scraper/services/fetch.service.js'

describe('FetchService (unit)', () => {
  it('returns 400 when engine is not supported', async () => {
    const configService = {
      get: jest.fn(() => ({ playwrightNavigationTimeoutSecs: 60 })),
    } as any

    const fingerprintService = {
      generateFingerprint: jest.fn(() => ({ headers: {} })),
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

    const service = new FetchService(
      configService,
      fingerprintService,
      concurrencyService,
      browserService,
      logger
    )

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
})
