/**
 * Interface for article extraction service
 * Provides abstraction for article-extractor library
 */
export interface IArticleExtractorOptions {
  headers?: Record<string, string>
}

export interface IArticleExtractor {
  /**
   * Extract article content from URL
   * @param url URL to extract article from
   * @param options Optional extraction options (e.g., headers)
   * @returns Promise with extracted article data
   */
  extract(url: string, options?: IArticleExtractorOptions): Promise<any>

  /**
   * Extract article content from HTML
   * @param html HTML content to extract article from
   * @param options Optional extraction options
   * @returns Promise with extracted article data
   */
  extractFromHtml(html: string, options?: IArticleExtractorOptions): Promise<any>
}
