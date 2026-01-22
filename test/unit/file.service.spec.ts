import { HttpException } from '@nestjs/common'

describe('FileService (unit)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    jest.resetModules()
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('sanitizeUpstreamRequestHeaders rejects dangerous headers and enforces limits', async () => {
    const { sanitizeUpstreamRequestHeaders } = await import(
      '@/modules/scraper/services/file.service.js'
    )

    expect(() => sanitizeUpstreamRequestHeaders({ Authorization: 'x' } as any)).toThrow(
      'Forbidden header'
    )
    expect(() => sanitizeUpstreamRequestHeaders({ Cookie: 'a=b' } as any)).toThrow(
      'Forbidden header'
    )

    const tooMany: Record<string, string> = {}
    for (let i = 0; i < 51; i++) {
      tooMany[`X-${i}`] = '1'
    }
    expect(() => sanitizeUpstreamRequestHeaders(tooMany)).toThrow('Too many headers')
  })

  it('sanitizeUpstreamResponseHeaders keeps content-encoding and removes set-cookie', async () => {
    const { sanitizeUpstreamResponseHeaders } = await import(
      '@/modules/scraper/services/file.service.js'
    )

    const out = sanitizeUpstreamResponseHeaders({
      'content-type': 'application/octet-stream',
      'content-encoding': 'gzip',
      'set-cookie': 'a=b',
    })

    expect(out['content-encoding']).toBe('gzip')
    expect(out['set-cookie']).toBeUndefined()
  })

  it('mode=playwright streams via undici using cookies from Playwright bootstrap', async () => {
    const fetchMock = jest.fn()

    await (jest as any).unstable_mockModule('undici', () => ({
      fetch: fetchMock,
    }))

    const { FileService } = await import('@/modules/scraper/services/file.service.js')

    const configService = {
      get: jest.fn(() => ({
        fileMaxRedirects: 7,
        fileMaxResponseBytes: 1024 * 1024,
        playwrightNavigationTimeoutSecs: 30,
      })),
    } as any

    const concurrencyService = {
      run: jest.fn(async (fn: () => Promise<any>) => await fn()),
    } as any

    const browserService = {
      withPage: jest.fn(async (cb: any) => {
        const page = {
          setExtraHTTPHeaders: jest.fn(async () => {}),
          goto: jest.fn(async () => {}),
          url: () => 'http://127.0.0.1/file.bin',
          context: () => ({
            cookies: async () => [{ name: 'cf', value: 'token' }],
          }),
        }
        return await cb(page)
      }),
    } as any

    const fingerprintService = {
      generateFingerprint: jest.fn(() => ({ fingerprint: {}, headers: {} })),
    } as any

    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })

    const headers = new Headers({
      'content-type': 'application/octet-stream',
    })

    fetchMock.mockResolvedValue({
      status: 200,
      headers,
      body,
    })

    const service = new FileService(
      configService,
      concurrencyService,
      browserService,
      fingerprintService,
      logger
    )

    const result = await service.proxyFile({
      url: 'http://127.0.0.1/file.bin',
      mode: 'playwright',
      timeoutSecs: 10,
    } as any)

    expect(result.modeUsed).toBe('playwright')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const callArgs = fetchMock.mock.calls[0][1]
    expect(callArgs.headers.Cookie).toBe('cf=token')
  })

  it('returns 413 when content-length exceeds maxBytes', async () => {
    const fetchMock = jest.fn()

    await (jest as any).unstable_mockModule('undici', () => ({
      fetch: fetchMock,
    }))

    const { FileService } = await import('@/modules/scraper/services/file.service.js')

    const configService = {
      get: jest.fn(() => ({
        fileMaxRedirects: 7,
        fileMaxResponseBytes: 10,
        playwrightNavigationTimeoutSecs: 30,
      })),
    } as any

    const concurrencyService = {
      run: jest.fn(async (fn: () => Promise<any>) => await fn()),
    } as any

    const browserService = {
      withPage: jest.fn(async (cb: any) => {
        const page = {
          setExtraHTTPHeaders: jest.fn(async () => {}),
          goto: jest.fn(async () => {}),
          url: () => 'http://127.0.0.1/file.bin',
          context: () => ({
            cookies: async () => [],
          }),
        }
        return await cb(page)
      }),
    } as any

    const fingerprintService = {
      generateFingerprint: jest.fn(() => ({ fingerprint: {}, headers: {} })),
    } as any

    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any

    const headers = new Headers({
      'content-type': 'application/octet-stream',
      'content-length': '999',
    })

    fetchMock.mockResolvedValue({
      status: 200,
      headers,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      }),
    })

    const service = new FileService(
      configService,
      concurrencyService,
      browserService,
      fingerprintService,
      logger
    )

    await expect(
      service.proxyFile({
        url: 'http://127.0.0.1/file.bin',
        mode: 'playwright',
        timeoutSecs: 10,
      } as any)
    ).rejects.toMatchObject({ status: 413 })

    try {
      await service.proxyFile({
        url: 'http://127.0.0.1/file.bin',
        mode: 'playwright',
        timeoutSecs: 10,
      } as any)
    } catch (e) {
      const resp = (e as any).getResponse?.() as any
      expect(resp.error.code).toBe('FILE_RESPONSE_TOO_LARGE')
    }
  })
})
