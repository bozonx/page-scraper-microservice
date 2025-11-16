import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { TurndownConverterService } from '@/modules/scraper/services/turndown.service';
import { createMockLogger } from '@test/helpers/mocks';

describe('TurndownConverterService (unit)', () => {
  let service: TurndownConverterService;
  let logger: PinoLogger;

  beforeAll(async () => {
    logger = createMockLogger();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TurndownConverterService,
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(TurndownConverterService);
  });

  it('should convert HTML to Markdown', () => {
    const html = '<h1>Title</h1><p>Content</p>';
    const result = service.convertToMarkdown(html);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty HTML', () => {
    const result = service.convertToMarkdown('');

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});
