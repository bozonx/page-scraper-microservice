import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { ValidationPipe } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from '@/app.module.js'
import nock from 'nock'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('Scraper MK.ru Article (e2e)', () => {
  let app: NestFastifyApplication
  const targetUrl =
    'https://www.mk.ru/incident/2025/11/17/voditel-podorval-granatu-vo-vremya-obshheniya-s-policiey-vo-lvovskoy-oblasti.html'
  const __dirname_es = dirname(fileURLToPath(import.meta.url))
  const htmlPath = join(__dirname_es, 'examples', 'mk-ru-1.html')
  let fixtureHtml: string

  beforeAll(() => {
    fixtureHtml = readFileSync(htmlPath, 'utf-8')
    nock.disableNetConnect()
    nock.enableNetConnect(/(127\.0\.0\.1|::1|localhost)/)
  })

  beforeEach(async () => {
    // Ensure defaults the same as in main.ts
    process.env.BASE_PATH = process.env.BASE_PATH ?? ''

    // Stub external HTTP request to mk.ru while keeping real library invocation
    nock('https://www.mk.ru').get(new URL(targetUrl).pathname).reply(200, fixtureHtml, {
      'Content-Type': 'text/html; charset=utf-8',
    })

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: false,
      })
    )

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    )

    const basePath = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')
    const globalPrefix = [basePath, 'api/v1'].filter(Boolean).join('/')
    app.setGlobalPrefix(globalPrefix)

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
    nock.cleanAll()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  describe('POST /api/v1/page - MK.ru article', () => {
    it('should scrape MK.ru article using real @extractus/article-extractor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          mode: 'extractor', // Use extractor mode for static content
        },
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)

      // Verify response structure
      expect(body).toHaveProperty('url')
      expect(body).toHaveProperty('title')
      expect(body).toHaveProperty('description')
      expect(body).toHaveProperty('body')
      expect(body).toHaveProperty('meta')
      expect(body).toHaveProperty('date')
      expect(body).toHaveProperty('author')

      // Verify URL
      expect(body.url).toBe(targetUrl)

      // Verify title
      expect(body.title).toBe(
        'Водитель подорвал гранату во время общения с полицией во Львовской области'
      )

      // Verify description
      expect(body.description).toContain('Согласно информации, распространенной агентством УНИАН')
      expect(body.description).toContain(
        'Самборского района за нарушение правил дорожного движения'
      )

      // Verify date
      expect(body.date).toBe('2025-11-17T00:31:57+0300')

      // Verify author
      expect(body.author).toBe('')

      // Verify body is converted to Markdown and contains expected content
      expect(body.body).toBeTruthy()
      expect(typeof body.body).toBe('string')
      expect(body.body.length).toBeGreaterThan(0)

      // Verify meta information
      expect(body.meta).toHaveProperty('readTimeMin')
      expect(body.meta.readTimeMin).toBeGreaterThan(0)
      expect(typeof body.meta.readTimeMin).toBe('number')

      // Verify language if present
      if (body.meta.lang) {
        expect(body.meta.lang).toBe('ru')
      }
    })

    it('should handle different scraper modes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          // Default mode should be used (extractor)
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.title).toBeTruthy()
      expect(body.body).toBeTruthy()
    })

    it('should calculate read time correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          mode: 'extractor',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Read time should be calculated based on word count (200 wpm)
      const wordCount = body.body.trim().split(/\s+/).length
      const expectedReadTime = Math.ceil(wordCount / 200)

      expect(body.meta.readTimeMin).toBe(expectedReadTime)
      expect(body.meta.readTimeMin).toBeGreaterThan(0)
    })
  })
})
