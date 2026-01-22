import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'

describe('Fetch /fetch (e2e)', () => {
  let app: NestFastifyApplication
  let testServer: ReturnType<typeof startTestServer>
  let baseUrl: string

  beforeAll(async () => {
    testServer = startTestServer(0)
    const address = testServer.address()
    if (!address || typeof address === 'string') {
      throw new Error('Test server address is not available')
    }
    baseUrl = `http://localhost:${address.port}`
    await new Promise((resolve) => setTimeout(resolve, 200))
    app = await createTestApp()
  }, 30000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (testServer) {
      testServer.close()
    }
  })

  it('returns HTML for engine=http', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/fetch',
      payload: {
        url: `${baseUrl}/test-page`,
        engine: 'http',
        timeoutSecs: 10,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.finalUrl).toBe(`${baseUrl}/test-page`)
    expect(typeof body.content).toBe('string')
    expect(body.content.toLowerCase()).toContain('<html')
    expect(body.meta.engine).toBe('http')
  })

  it('allows RSS mime type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/fetch',
      payload: {
        url: `${baseUrl}/rss`,
        engine: 'http',
        timeoutSecs: 10,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.finalUrl).toBe(`${baseUrl}/rss`)
    expect(body.detectedContentType).toContain('application/rss+xml')
    expect(body.content).toContain('<rss')
  })

  it('follows redirects and returns finalUrl', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/fetch',
      payload: {
        url: `${baseUrl}/redirect`,
        engine: 'http',
        timeoutSecs: 10,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.finalUrl).toBe(`${baseUrl}/test-page`)
    expect(body.content.toLowerCase()).toContain('<html')
  })
})
