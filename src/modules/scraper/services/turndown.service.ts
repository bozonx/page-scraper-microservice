import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import TurndownService from 'turndown'

/**
 * Service that provides TurndownService instance for HTML to Markdown conversion
 * Configured with consistent formatting options for clean markdown output
 */
@Injectable()
export class TurndownConverterService {
  public readonly turndownService: TurndownService

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(TurndownConverterService.name)
    
    // Initialize TurndownService with standardized configuration
    this.turndownService = new TurndownService({
      headingStyle: 'atx',           // Use ATX-style headings (# ## ###)
      bulletListMarker: '-',          // Use hyphens for bullet points
      codeBlockStyle: 'fenced',       // Use fenced code blocks (``` ```)
      emDelimiter: '*',              // Use asterisks for emphasis
      strongDelimiter: '**',         // Use double asterisks for strong emphasis
    })
  }

  /**
   * Convert HTML to Markdown
   * @param html HTML content to convert
   * @returns Markdown string
   */
  convertToMarkdown(html: string): string {
    try {
      this.logger.debug('Converting HTML to Markdown')
      return this.turndownService.turndown(html)
    } catch (error) {
      this.logger.error('Failed to convert HTML to Markdown:', error)
      throw error
    }
  }
}