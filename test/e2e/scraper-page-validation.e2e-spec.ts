import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'

describe('Scraper /page validation (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('returns 400 when url is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/page',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when url is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/page',
      payload: { url: 'not-a-url' },
    })

    expect(response.statusCode).toBe(400)
  })
})
