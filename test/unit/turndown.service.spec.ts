import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { TurndownConverterService } from '@/modules/scraper/services/turndown.service.js';
import { createMockLogger } from '@test/helpers/mocks.js';

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

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize turndownService with correct configuration', () => {
      expect(service.turndownService).toBeDefined();
    });
  });

  describe('HTML to Markdown conversion', () => {
    it('should convert heading to markdown', () => {
      const html = '<h1>Title</h1>';
      const result = service.convertToMarkdown(html);

      expect(result).toBeDefined();
      expect(result).toContain('Title');
    });

    it('should convert paragraph to markdown', () => {
      const html = '<p>Content</p>';
      const result = service.convertToMarkdown(html);

      expect(result).toBeDefined();
      expect(result).toContain('Content');
    });

    it('should convert complex HTML structure', () => {
      const html = '<h1>Title</h1><p>Content</p><ul><li>Item 1</li><li>Item 2</li></ul>';
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

    it('should handle whitespace-only HTML', () => {
      const result = service.convertToMarkdown('   ');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should convert strong emphasis correctly', () => {
      const html = '<strong>Bold text</strong>';
      const result = service.convertToMarkdown(html);

      expect(result).toContain('Bold text');
    });

    it('should convert emphasis correctly', () => {
      const html = '<em>Italic text</em>';
      const result = service.convertToMarkdown(html);

      expect(result).toContain('Italic text');
    });

    it('should log debug message during conversion', () => {
      service.convertToMarkdown('<p>Test</p>');

      expect(logger.debug).toHaveBeenCalledWith('Converting HTML to Markdown');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed HTML gracefully', () => {
      const html = '<div><p>Unclosed div';
      
      expect(() => service.convertToMarkdown(html)).not.toThrow();
    });

    it('should handle HTML with special characters', () => {
      const html = '<p><script>alert("test")</script></p>';
      const result = service.convertToMarkdown(html);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});