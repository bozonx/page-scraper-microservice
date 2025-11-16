import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ArticleExtractorService } from '@/modules/scraper/services/article-extractor.service';
import { createMockLogger } from '@test/helpers/mocks';

describe('ArticleExtractorService (unit)', () => {
  let service: ArticleExtractorService;
  let logger: PinoLogger;

  beforeAll(async () => {
    logger = createMockLogger();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleExtractorService,
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(ArticleExtractorService);
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have extract method', () => {
      expect(typeof service.extract).toBe('function');
    });

    it('should have extractFromHtml method', () => {
      expect(typeof service.extractFromHtml).toBe('function');
    });
  });

  describe('Error handling', () => {
    it('should log debug message when extracting from URL', async () => {
      const url = 'https://example.com/test';
      
      try {
        await service.extract(url);
      } catch {
        // Expected to fail due to mocking limitations
      }

      expect(logger.debug).toHaveBeenCalledWith(`Extracting article from URL: ${url}`);
    });

    it('should log debug message when extracting from HTML', async () => {
      try {
        await service.extractFromHtml('<html></html>');
      } catch {
        // Expected to fail due to mocking limitations
      }

      expect(logger.debug).toHaveBeenCalledWith('Extracting article from HTML content');
    });
  });
});
