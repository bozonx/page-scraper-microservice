import { HttpException } from '@nestjs/common'
import { FetchService } from '@/modules/scraper/services/fetch.service.js'

describe('FetchService (unit)', () => {
  it('returns 400 when engine is not supported', async () => {
    const fingerprintService = {
      generateFingerprint: jest.fn(() => ({ headers: {} })),
    } as any

    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any

    const service = new FetchService(fingerprintService, logger)

    await expect(
      service.fetch({ url: 'https://example.com', engine: 'playwright', timeoutSecs: 1 } as any)
    ).rejects.toMatchObject({
      status: 400,
    })

    try {
      await service.fetch({
        url: 'https://example.com',
        engine: 'playwright',
        timeoutSecs: 1,
      } as any)
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException)
      const resp = (e as HttpException).getResponse() as any
      expect(resp.error.code).toBe('FETCH_ENGINE_NOT_SUPPORTED')
    }
  })
})
