import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'

describe('Scraper /html (e2e)', () => {
  let app: NestFastifyApplication
  let testServer: ReturnType<typeof startTestServer>
  const targetUrl = 'http://localhost:8081/test-page'

  beforeAll(async () => {
    testServer = startTestServer(8081)
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
        blockTrackers: true,
        blockHeavyResources: true,
        taskTimeoutSecs: 60,
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
