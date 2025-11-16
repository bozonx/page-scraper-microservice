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
