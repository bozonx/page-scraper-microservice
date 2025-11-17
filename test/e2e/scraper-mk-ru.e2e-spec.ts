import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '@/app.module.js';

describe('Scraper MK.ru Article (e2e)', () => {
  let app: NestFastifyApplication;
  const targetUrl = 'https://www.mk.ru/incident/2025/11/17/voditel-podorval-granatu-vo-vremya-obshheniya-s-policiey-vo-lvovskoy-oblasti.html';

  beforeEach(async () => {
    // Ensure defaults the same as in main.ts
    process.env.API_BASE_PATH = process.env.API_BASE_PATH ?? 'api';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: false,
      })
    );

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    const apiBasePath = (process.env.API_BASE_PATH || 'api').replace(/^\/+|\/+$/g, '');
    app.setGlobalPrefix(`${apiBasePath}/v1`);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/page - MK.ru article', () => {
    it('should scrape MK.ru article using real @extractus/article-extractor', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          mode: 'cheerio', // Use cheerio mode for static content
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      
      // Verify response structure
      expect(body).toHaveProperty('url');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('description');
      expect(body).toHaveProperty('body');
      expect(body).toHaveProperty('meta');
      
      // Verify URL
      expect(body.url).toBe(targetUrl);
      
      // Verify title
      expect(body.title).toBe('Водитель подорвал гранату во время общения с полицией во Львовской области');
      
      // Verify description
      expect(body.description).toContain('Согласно информации, распространенной агентством УНИАН');
      expect(body.description).toContain('Самборского района за нарушение правил дорожного движения');
      
      // Verify body is converted to Markdown and contains expected content
      expect(body.body).toBeTruthy();
      expect(typeof body.body).toBe('string');
      expect(body.body.length).toBeGreaterThan(0);
      
      // Verify meta information
      expect(body.meta).toHaveProperty('readTimeMin');
      expect(body.meta.readTimeMin).toBeGreaterThan(0);
      expect(typeof body.meta.readTimeMin).toBe('number');
      
      // Verify language if present
      if (body.meta.lang) {
        expect(body.meta.lang).toBe('ru');
      }
    });

    it('should handle different scraper modes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          // Default mode should be used (cheerio)
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBeTruthy();
      expect(body.body).toBeTruthy();
    });

    it('should calculate read time correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: {
          url: targetUrl,
          mode: 'cheerio',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Read time should be calculated based on word count (200 wpm)
      const wordCount = body.body.trim().split(/\s+/).length;
      const expectedReadTime = Math.ceil(wordCount / 200);
      
      expect(body.meta.readTimeMin).toBe(expectedReadTime);
      expect(body.meta.readTimeMin).toBeGreaterThan(0);
    });
  });
});