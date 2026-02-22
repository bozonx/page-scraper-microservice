import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createTestApp } from '../helpers/test-app.factory.js'

describe('Authentication (e2e)', () => {
  let app: NestFastifyApplication

  const setupApp = async (tokens?: string) => {
    if (tokens !== undefined) {
      process.env.AUTH_BEARER_TOKENS = tokens
    } else {
      delete process.env.AUTH_BEARER_TOKENS
    }
    app = await createTestApp()
  }

  afterEach(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AUTH_BEARER_TOKENS
  })

  describe('When AUTH_BEARER_TOKENS is NOT set', () => {
    beforeEach(async () => {
      await setupApp()
    })

    it('allows access to endpoints without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      })
      expect(response.statusCode).toBe(200)
    })
  })

  describe('When AUTH_BEARER_TOKENS is set to "test-token-1,test-token-2"', () => {
    beforeEach(async () => {
      await setupApp('test-token-1,test-token-2')
    })

    it('allows access to @Public() health endpoint without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      })
      expect(response.statusCode).toBe(200)
    })

    it('blocks access to protected endpoints without token (401)', async () => {
      // Assuming /api/v1/fetch is protected
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fetch',
        payload: { url: 'http://example.com' },
      })
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Missing bearer token')
    })

    it('blocks access with invalid token (401)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fetch',
        headers: {
          authorization: 'Bearer invalid-token',
        },
        payload: { url: 'http://example.com' },
      })
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Invalid bearer token')
    })

    it('allows access with valid token-1 (200/201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fetch',
        headers: {
          authorization: 'Bearer test-token-1',
        },
        payload: { url: 'http://example.com' },
      })
      // We don't care about the exact success code, just that it's not 401
      expect(response.statusCode).not.toBe(401)
    })

    it('allows access with valid token-2 (200/201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/fetch',
        headers: {
          authorization: 'Bearer test-token-2',
        },
        payload: { url: 'http://example.com' },
      })
      expect(response.statusCode).not.toBe(401)
    })
  })
})
