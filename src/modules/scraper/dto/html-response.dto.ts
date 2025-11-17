/**
 * HTML response DTO
 * Defines the structure of raw HTML retrieval responses
 */
export interface HtmlResponseDto {
  /**
   * Original URL that was retrieved
   */
  url: string

  /**
   * Raw HTML content of the page
   */
  html: string
}
