import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory.js'
import nock from 'nock'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('Scraper Playwright (e2e)', () => {
  let app: NestFastifyApplication
  const targetUrl = 'http://example.com/test-page'
  const __dirname_es = dirname(fileURLToPath(import.meta.url))
  const htmlPath = join(__dirname_es, 'examples', 'test-page.html')
  let fixtureHtml: string

  beforeAll(async () => {
    fixtureHtml = readFileSync(htmlPath, 'utf-8')
    nock.disableNetConnect()
    nock('http://example.com').get('/test-page').reply(200, fixtureHtml, {
      'Content-Type': 'text/html; charset=utf-8',
    })
    app = await createTestApp()
  })

  afterAll(async () => {
    if (app) await app.close()
    nock.cleanAll()
    nock.enableNetConnect()
  })

  it('POST /api/v1/page in playwright mode returns structured content', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/page',
      payload: {
        url: targetUrl,
        mode: 'playwright',
        blockTrackers: true,
        blockHeavyResources: true,
        taskTimeoutSecs: 30,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(body).toHaveProperty('url')
    expect(body).toHaveProperty('body')
    expect(body).toHaveProperty('meta')
    expect(body.url).toBe(targetUrl)
    expect(typeof body.body).toBe('string')
    expect(body.meta.readTimeMin).toBeGreaterThanOrEqual(0)
  })
})
