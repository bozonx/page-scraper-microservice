import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from './test-app.factory.js'

describe('HTML Endpoint (e2e)', () => {
  let app: NestFastifyApplication

  beforeEach(async () => {
    // Create fresh app instance for each test for better isolation
    app = await createTestApp()
  })

  afterEach(async () => {
    // Clean up app instance after each test
    if (app) {
      await app.close()
    }
  })

  describe('POST /api/v1/html', () => {
    it('retrieves raw HTML content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://example.com',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('url', 'https://example.com')
      expect(body).toHaveProperty('html')
      expect(typeof body.html).toBe('string')
      expect(body.html.length).toBeGreaterThan(0)
      expect(body.html).toContain('<!DOCTYPE html>')
    })

    it('applies custom timeout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://example.com',
          taskTimeoutSecs: 60,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('url')
      expect(body).toHaveProperty('html')
    })

    it('applies locale and timezone', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://example.com',
          locale: 'ru-RU',
          timezoneId: 'Europe/Moscow',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('url')
      expect(body).toHaveProperty('html')
    })

    it('applies blocking settings', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://example.com',
          blockTrackers: true,
          blockHeavyResources: true,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('url')
      expect(body).toHaveProperty('html')
    })

    it('applies fingerprint configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://example.com',
          fingerprint: {
            generate: true,
            userAgent: 'Custom User Agent',
            locale: 'en-US',
            timezoneId: 'UTC',
          },
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('url')
      expect(body).toHaveProperty('html')
    })

    it('returns 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'not-a-valid-url',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('returns 400 for missing URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {},
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
    })

    it('handles timeout errors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/html',
        payload: {
          url: 'https://httpstat.us/200?sleep=120000', // Will timeout
          taskTimeoutSecs: 1,
        },
      })

      expect(response.statusCode).toBe(504)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code', 504)
    })
  })
})
