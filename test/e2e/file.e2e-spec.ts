import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'
import { startTestServer } from '../helpers/test-server.js'
import { isPlaywrightAvailable } from '../helpers/playwright-available.js'

describe('File /file (e2e)', () => {
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

  it('streams binary content for mode=http', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/file',
      payload: {
        url: `${baseUrl}/binary`,
        mode: 'http',
        timeoutSecs: 10,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-mode-used']).toBe('http')
    expect(response.headers['content-type']).toContain('application/octet-stream')
    expect(response.rawPayload).toBeDefined()
    expect(Buffer.isBuffer(response.rawPayload)).toBe(true)
    expect((response.rawPayload as Buffer).length).toBeGreaterThan(0)
  })
})

const describeIfPlaywright = isPlaywrightAvailable() ? describe : describe.skip

describeIfPlaywright('File /file (e2e) mode=playwright', () => {
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

  it('returns binary content for mode=playwright', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/file',
      payload: {
        url: `${baseUrl}/binary`,
        mode: 'playwright',
        timeoutSecs: 60,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-mode-used']).toBe('playwright')
    expect(Buffer.isBuffer(response.rawPayload)).toBe(true)
    expect((response.rawPayload as Buffer).length).toBeGreaterThan(0)
  }, 30000)
})
