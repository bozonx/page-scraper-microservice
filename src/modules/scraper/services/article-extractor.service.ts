import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import type { IArticleExtractor, IArticleExtractorOptions } from './article-extractor.interface.js'

/**
 * Implementation of article extractor service using @extractus/article-extractor library
 * Provides content extraction from URLs and HTML strings
 */
@Injectable()
export class ArticleExtractorService implements IArticleExtractor {
  private extractorModule?: Promise<any>

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ArticleExtractorService.name)
  }

  /**
   * Lazily loads article extractor module to improve startup time
   * @returns Promise resolving to article extractor module
   */
  private getModule() {
    if (!this.extractorModule) {
      this.extractorModule = import('@extractus/article-extractor')
    }
    return this.extractorModule
  }

  /**
   * Extract article content from URL
   * @param url URL to extract article from
   * @returns Promise with extracted article data
   */
  async extract(url: string, options?: IArticleExtractorOptions): Promise<any> {
    try {
      this.logger.debug(`Extracting article from URL: ${url}`)
      const mod = await this.getModule()
      return await mod.extract(url, options)
    } catch (error) {
      this.logger.error(`Failed to extract article from URL ${url}:`, error)
      throw error
    }
  }

  /**
   * Extract article content from HTML
   * @param html HTML content to extract article from
   * @returns Promise with extracted article data
   */
  async extractFromHtml(html: string, options?: IArticleExtractorOptions): Promise<any> {
    try {
      this.logger.debug('Extracting article from HTML content')
      const mod = await this.getModule()
      return await mod.extractFromHtml(html, options)
    } catch (error) {
      this.logger.error('Failed to extract article from HTML:', error)
      throw error
    }
  }
}
