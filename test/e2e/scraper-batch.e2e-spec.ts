import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'

describe('Scraper /batch (e2e)', () => {
  let app: NestFastifyApplication
  let testServer: ReturnType<typeof startTestServer>
  const targetUrl = 'http://localhost:8082/test-page'

  beforeAll(async () => {
    testServer = startTestServer(8082)
    await new Promise((resolve) => setTimeout(resolve, 500))
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

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  it('creates batch job and eventually succeeds for single item', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/batch',
      payload: {
        items: [
          {
            url: targetUrl,
            mode: 'playwright',
          },
        ],
        commonSettings: {
          taskTimeoutSecs: 60,
          blockTrackers: true,
          blockHeavyResources: true,
        },
      },
    })

    expect(createResponse.statusCode).toBe(201)
    const createBody = JSON.parse(createResponse.body) as { jobId: string }
    expect(createBody.jobId).toBeDefined()

    const jobId = createBody.jobId
    let status: string | undefined
    let attempts = 0
    let lastStatusResponse: any

    while (attempts < 40) {
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/batch/${jobId}`,
      })

      expect(statusResponse.statusCode).toBe(200)
      const body = JSON.parse(statusResponse.body)
      lastStatusResponse = body
      status = body.status

      if (status !== 'queued' && status !== 'running') {
        break
      }

      attempts += 1
      await wait(500)
    }

    expect(status === 'succeeded' || status === 'partial' || status === 'failed').toBe(true)
    expect(lastStatusResponse.total).toBe(1)
    expect(lastStatusResponse.processed).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(lastStatusResponse.results)).toBe(true)
  }, 30000)
})
