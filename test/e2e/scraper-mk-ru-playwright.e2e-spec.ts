import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory.js'
import nock from 'nock'

// Playwright mode e2e test hitting a real page once
// Keeps assertions minimal to avoid flakiness and long runtimes

describe('Scraper Playwright (e2e)', () => {
  let app: NestFastifyApplication
  // Use a data: URL to avoid external network/anti-bot flakiness while still running a real browser
  const targetUrl =
    'data:text/html;charset=utf-8,' +
    encodeURIComponent(`
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <meta name="description" content="Короткое описание статьи" />
          <title>Тестовая статья</title>
        </head>
        <body>
          <article>
            <h1>Заголовок</h1>
            <p>Это тестовый контент статьи с несколькими словами для расчета времени чтения.</p>
          </article>
        </body>
      </html>
    `)

  beforeAll(async () => {
    // Mirror e2e network policy: block external connections
    nock.disableNetConnect()
    nock.enableNetConnect(/(127\.0\.0\.1|::1|localhost)/)
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
    expect(body.body.length).toBeGreaterThan(0)

    expect(body.meta).toHaveProperty('readTimeMin')
    expect(typeof body.meta.readTimeMin).toBe('number')
    expect(body.meta.readTimeMin).toBeGreaterThanOrEqual(0)
  })
})
