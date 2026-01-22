import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'
import { isPlaywrightAvailable } from '../helpers/playwright-available.js'

const describeIfPlaywright = isPlaywrightAvailable() ? describe : describe.skip

describeIfPlaywright('Scraper /html (e2e)', () => {
  let app: NestFastifyApplication
  let testServer: ReturnType<typeof startTestServer>
  let targetUrl: string

  beforeAll(async () => {
    testServer = startTestServer(0)
    const address = testServer.address()
    if (!address || typeof address === 'string') {
      throw new Error('Test server address is not available')
    }
    targetUrl = `http://localhost:${address.port}/test-page`
    await new Promise((resolve) => setTimeout(resolve, 500))
    app = await createTestApp()
  }, 20000)

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (testServer) {
      testServer.close()
    }
  })

  it('returns raw HTML for given URL', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/html',
      payload: {
        url: targetUrl,
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
    expect(body).toHaveProperty('html')
    expect(typeof body.html).toBe('string')
    expect(body.html.length).toBeGreaterThan(0)
    expect(body.html).toContain('<title>Тестовая статья</title>')
  }, 20000)
})
