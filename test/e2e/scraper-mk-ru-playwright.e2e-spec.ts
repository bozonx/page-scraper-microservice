import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'

describe('Scraper Playwright (e2e)', () => {
  let app: NestFastifyApplication
  let testServer: ReturnType<typeof startTestServer>
  const targetUrl = 'http://localhost:8081/test-page'

  beforeAll(async () => {
    testServer = startTestServer(8081)
    // Даем серверу время запуститься
    await new Promise((resolve) => setTimeout(resolve, 500))
    app = await createTestApp()
  }, 15000)

  afterAll(async () => {
    if (app) await app.close()
    testServer.close()
  })

  it('POST /api/v1/page in playwright mode returns structured content', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/page',
      payload: {
        url: targetUrl,
        mode: 'playwright',
        taskTimeoutSecs: 60,
        fingerprint: {
          blockTrackers: true,
          blockHeavyResources: true,
        },
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(body).toHaveProperty('url', targetUrl)
    expect(body).toHaveProperty('body')
    expect(typeof body.body).toBe('string')
    expect(body.meta.readTimeMin).toBeGreaterThanOrEqual(0)
  }, 15000)
})
