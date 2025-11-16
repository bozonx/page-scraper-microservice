/**
 * Scraper metadata DTO
 * Contains additional metadata about the scraped content
 */
export interface ScraperMetaDto {
  /**
   * Language code of the extracted content
   */
  lang?: string
  
  /**
   * Estimated reading time in minutes (calculated at 200 words per minute)
   */
  readTimeMin?: number
}

/**
 * Scraper response DTO
 * Defines the structure of successful scraping responses
 */
export interface ScraperResponseDto {
  /**
   * Original URL that was scraped
   */
  url: string
  
  /**
   * Extracted page title
   */
  title?: string
  
  /**
   * Extracted page description (meta description)
   */
  description?: string
  
  /**
   * Publication date of the content
   */
  date?: string
  
  /**
   * Author of the content
   */
  author?: string
  
  /**
   * Main content body converted to Markdown format
   */
  body?: string
  
  /**
   * Additional metadata about the scraped content
   */
  meta?: ScraperMetaDto
}

/**
 * Scraper error DTO
 * Defines the structure of error responses
 */
export interface ScraperErrorDto {
  /**
   * HTTP status code
   */
  code: number
  
  /**
   * Error message
   */
  message: string
  
  /**
   * Optional detailed error information
   */
  details?: string
}

/**
 * Scraper error response DTO
 * Defines the structure of error response envelopes
 */
export interface ScraperErrorResponseDto {
  /**
   * Error object containing error details
   */
  error: ScraperErrorDto
}