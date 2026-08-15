import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'

describe('BASE_PATH (e2e)', () => {
  let app: NestFastifyApplication
  const originalBasePath = process.env.BASE_PATH

  beforeAll(async () => {
    process.env.BASE_PATH = '/scraper/'
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
    if (originalBasePath === undefined) delete process.env.BASE_PATH
    else process.env.BASE_PATH = originalBasePath
  })

  it('serves health below the normalized base path', async () => {
    const response = await app.inject({ method: 'GET', url: '/scraper/api/v1/health' })
    expect(response.statusCode).toBe(200)
  })
})
