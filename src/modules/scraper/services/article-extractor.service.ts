import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { IArticleExtractor } from './article-extractor.interface'

/**
 * Implementation of article extractor service using @extractus/article-extractor library
 */
@Injectable()
export class ArticleExtractorService implements IArticleExtractor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ArticleExtractorService.name)
  }

  private extractorModule?: Promise<any>

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
  async extract(url: string): Promise<any> {
    try {
      this.logger.debug(`Extracting article from URL: ${url}`)
      const mod = await this.getModule()
      return await mod.extract(url)
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
  async extractFromHtml(html: string): Promise<any> {
    try {
      this.logger.debug('Extracting article from HTML content')
      const mod = await this.getModule()
      return await mod.extractFromHtml(html)
    } catch (error) {
      this.logger.error('Failed to extract article from HTML:', error)
      throw error
    }
  }
}