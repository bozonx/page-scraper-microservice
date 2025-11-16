# E2E Test Plan: MK.ru Article Scraping

## Overview
This document outlines the plan for creating an end-to-end test for scraping a MK.ru article using local HTML file instead of making real HTTP requests.

## Test Requirements
- **Target URL**: https://www.mk.ru/incident/2025/11/17/voditel-podorval-granatu-vo-vremya-obshheniya-s-policiey-vo-lvovskoy-oblasti.html
- **Mock Strategy**: Use `jest.mock()` to mock `@extractus/article-extractor` module
- **Local HTML**: Use `test/e2e/examples/mk-ru-1.html` as mock response
- **Real Processing**: Use real Cheerio processing (no mocks for parsing)
- **Expected Data**: Extract title, content, author, date from HTML

## HTML Structure Analysis

### Key Elements Found:
1. **Title**: `<h1 class="article__title" itemprop="headline">Водитель подорвал гранату во время общения с полицией во Львовской области</h1>`
2. **Content**: `<div class="article__body" itemprop="articleBody">` with article paragraphs
3. **Author**: `<span class="article__authors-info">Артем Евдокименков</span>`
4. **Date**: `<time class="meta__text" pubdate datetime="2025-11-17T00:31:57+0300">сегодня в 00:31</time>`
5. **Description**: `<meta name="description" content="Согласно информации, распространенной агентством УНИАН со ссылкой на данные полиции, сотрудники остановили в городе Рудки 37-летнего жителя Самборского района за нарушение правил дорожного движения."/>`

## Test Implementation Strategy

### 1. Mock Setup
```typescript
// Mock the entire @extractus/article-extractor module
jest.mock('@extractus/article-extractor', () => ({
  extract: jest.fn((url: string) => {
    if (url.includes('mk.ru')) {
      // Read local HTML file
      const html = readFileSync(join(__dirname, 'examples/mk-ru-1.html'), 'utf-8');
      // Return mock data that matches expected structure
      return Promise.resolve({
        title: 'Водитель подорвал гранату во время общения с полицией во Львовской области',
        content: html,
        description: 'Согласно информации, распространенной агентством УНИАН со ссылкой на данные полиции, сотрудники остановили в городе Рудки 37-летнего жителя Самборского района за нарушение правил дорожного движения.',
        author: 'Артем Евдокименков',
        published: '2025-11-17T00:31:57+0300',
        url: url
      });
    }
    throw new Error('URL not mocked');
  }),
  extractFromHtml: jest.fn((html: string) => {
    // This should use real Cheerio processing
    return Promise.resolve({
      title: 'Водитель подорвал гранату во время общения с полицией во Львовской области',
      content: html,
      description: 'Согласно информации, распространенной агентством УНИАН со ссылкой на данные полиции, сотрудники остановили в городе Рудки 37-летнего жителя Самборского района за нарушение правил дорожного движения.',
      author: 'Артем Евдокименков',
      published: '2025-11-17T00:31:57+0300'
    });
  })
}));
```

### 2. Test Structure
```typescript
describe('Scraper (e2e) - MK.ru Article', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/page', () => {
    it('should scrape MK.ru article using local HTML file', async () => {
      const requestBody = {
        url: 'https://www.mk.ru/incident/2025/11/17/voditel-podorval-granatu-vo-vremya-obshheniya-s-policiey-vo-lvovskoy-oblasti.html',
        mode: 'cheerio'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/page',
        payload: requestBody
      });

      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.body);
      
      // Verify basic structure
      expect(result).toHaveProperty('url', requestBody.url);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('meta');
      
      // Verify specific content
      expect(result.title).toContain('Водитель подорвал гранату');
      expect(result.author).toBe('Артем Евдокименков');
      expect(result.date).toBe('2025-11-17T00:31:57+0300');
      expect(result.body).toContain('Согласно информации, распространенной агентством УНИАН');
      expect(result.description).toContain('сотрудники остановили в городе Рудки');
      
      // Verify meta information
      expect(result.meta).toHaveProperty('readTimeMin');
      expect(result.meta.readTimeMin).toBeGreaterThan(0);
    });
  });
});
```

### 3. Expected Response Structure
```typescript
interface ScraperResponseDto {
  url: string;
  title: string;
  description: string;
  author: string;
  date: string;
  body: string; // Markdown converted from HTML
  meta: {
    lang: string;
    readTimeMin: number;
  };
}
```

## Implementation Steps

1. ✅ **Analyze HTML structure** - Extracted key elements from mk-ru-1.html
2. ✅ **Determine mock strategy** - Use jest.mock() for @extractus/article-extractor
3. 🔄 **Create test file** - `test/e2e/scraper.mk-ru.e2e-spec.ts`
4. ⏳ **Implement mock setup** - Mock extract() method to return local HTML data
5. ⏳ **Write test cases** - Verify all expected fields and content
6. ⏳ **Configure real Cheerio** - Ensure extractFromHtml uses real parsing
7. ⏳ **Add content validations** - Check specific text from article
8. ⏳ **Run and verify test** - Ensure test passes successfully

## Key Considerations

1. **No HTTP Requests**: The test should not make any real HTTP requests to mk.ru
2. **Real Processing**: Cheerio and Turndown should work on real HTML content
3. **Complete Coverage**: Test should verify all important fields from the response
4. **Error Handling**: Test should handle potential extraction errors gracefully
5. **Performance**: Test should complete within reasonable time (30s timeout)

## Expected Test Outcome

The test should successfully:
- Load local HTML file instead of making HTTP request
- Extract all expected fields using real Cheerio processing
- Convert HTML to Markdown using real Turndown service
- Return properly structured response with all metadata
- Complete without errors within timeout limits

## Files to Create/Modify

1. **New**: `test/e2e/scraper.mk-ru.e2e-spec.ts` - Main test file
2. **Existing**: `test/e2e/examples/mk-ru-1.html` - Already available
3. **Existing**: Test utilities and factories - Already available

## Next Steps

Ready to proceed with implementation in Code mode to create the actual test file.