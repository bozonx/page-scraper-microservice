import { createServer, IncomingMessage } from 'node:http'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'

describe('Scraper /batch webhook (e2e)', () => {
  let app: NestFastifyApplication
  let testPageServer: ReturnType<typeof startTestServer>
  let webhookServer: ReturnType<typeof createServer>
  let receivedBody: any | null = null
  let receivedHeaders: IncomingMessage['headers'] | null = null

  const targetUrl = 'http://localhost:8083/test-page'
  const webhookPort = 8084
  const webhookUrl = `http://localhost:${webhookPort}/webhook`

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  beforeAll(async () => {
    // Start test page server on dedicated port
    testPageServer = startTestServer(8083)

    // Start webhook receiver server
    webhookServer = createServer((req, res) => {
      receivedHeaders = req.headers
      const chunks: Buffer[] = []

      req.on('data', (chunk) => {
        chunks.push(chunk as Buffer)
      })

      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf-8')
        try {
          receivedBody = JSON.parse(rawBody)
        } catch {
          receivedBody = rawBody
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      })
    })

    webhookServer.listen(webhookPort)

    // Give servers time to start
    await wait(500)

    app = await createTestApp()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    if (testPageServer) {
      testPageServer.close()
    }
    if (webhookServer) {
      webhookServer.close()
    }
  })

  it('sends webhook on batch completion with expected payload', async () => {
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
          taskTimeoutSecs: 30,
        },
        webhook: {
          url: webhookUrl,
          headers: {
            'X-Test-Webhook': 'batch-webhook-e2e',
          },
        },
      },
    })

    expect(createResponse.statusCode).toBe(201)
    const createBody = JSON.parse(createResponse.body) as { jobId: string }
    expect(createBody.jobId).toBeDefined()

    const jobId = createBody.jobId

    // Poll job status until it reaches a terminal state
    let status: string | undefined
    let attempts = 0

    while (attempts < 40) {
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/batch/${jobId}`,
      })

      expect(statusResponse.statusCode).toBe(200)
      const body = JSON.parse(statusResponse.body)
      status = body.status

      if (status !== 'queued' && status !== 'running') {
        break
      }

      attempts += 1
      await wait(500)
    }

    expect(status === 'succeeded' || status === 'partial' || status === 'failed').toBe(true)

    // Give webhook sender a bit of time to deliver the request
    let webhookAttempts = 0
    while (!receivedBody && webhookAttempts < 20) {
      webhookAttempts += 1
      await wait(250)
    }

    expect(receivedBody).toBeDefined()
    expect(typeof receivedBody).toBe('object')
    expect(receivedBody.jobId).toBe(jobId)
    expect(receivedBody.status).toBeDefined()
    expect(receivedBody.total).toBe(1)
    expect(receivedBody.processed).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(receivedBody.results)).toBe(true)

    // Basic header check to ensure custom headers are forwarded
    expect(receivedHeaders).toBeDefined()
    expect(receivedHeaders?.['x-test-webhook']).toBe('batch-webhook-e2e')
  })
})
