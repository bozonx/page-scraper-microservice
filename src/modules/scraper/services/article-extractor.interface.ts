/**
 * Interface for article extraction service
 * Provides abstraction for article-extractor library
 */
export interface IArticleExtractor {
  /**
   * Extract article content from URL
   * @param url URL to extract article from
   * @returns Promise with extracted article data
   */
  extract(url: string): Promise<any>

  /**
   * Extract article content from HTML
   * @param html HTML content to extract article from
   * @returns Promise with extracted article data
   */
  extractFromHtml(html: string): Promise<any>
}