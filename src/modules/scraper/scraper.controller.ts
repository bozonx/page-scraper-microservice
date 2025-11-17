import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from './services/scraper.service.js'
import { BatchService } from './services/batch.service.js'
import { CleanupService } from './services/cleanup.service.js'
import { MemoryStoreService } from './services/memory-store.service.js'
import { ScraperRequestDto } from './dto/scraper-request.dto.js'
import { ScraperResponseDto, ScraperErrorResponseDto } from './dto/scraper-response.dto.js'
import { HtmlRequestDto } from './dto/html-request.dto.js'
import { HtmlResponseDto } from './dto/html-response.dto.js'
import { BatchRequestDto, BatchResponseDto, BatchJobStatusDto } from './dto/batch.dto.js'
import {
  ScraperException,
  ScraperTimeoutException,
  ScraperBrowserException,
  ScraperValidationException,
  ScraperContentExtractionException,
  BatchJobNotFoundException,
  BatchJobCreationException,
  BatchJobStatusException,
} from '@common/exceptions/scraper.exception.js'

/**
 * Scraper controller
 * Handles HTTP requests for web scraping operations and batch job management
 */
@Controller()
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly batchService: BatchService,
    private readonly cleanupService: CleanupService,
    private readonly memoryStoreService: MemoryStoreService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ScraperController.name)
  }

  /**
   * Scrapes a single page and extracts its content
   * @param request Scraper request parameters
   * @returns Extracted page content
   */
  @Post('page')
  @HttpCode(HttpStatus.OK)
  async scrapePage(@Body() request: ScraperRequestDto): Promise<ScraperResponseDto> {
    try {
      this.logger.info(`Received scrape request for URL: ${request.url}`)
      const cleanupPromise = this.cleanupService.triggerCleanup()
      const resultPromise = this.scraperService
        .scrapePage(request)
        .then((res: ScraperResponseDto) => {
          this.memoryStoreService.addPage(request, res)
          return res
        })
      const [, result] = await Promise.all([cleanupPromise, resultPromise])
      this.logger.info(`Successfully scraped ${request.url}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to scrape ${request.url}:`, error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's already a ScraperException
      if (error instanceof ScraperException) {
        throw error
      }

      // Convert to appropriate ScraperException based on error message
      const errorCode = this.getErrorCode(errorMessage)

      switch (errorCode) {
        case 504:
          throw new ScraperTimeoutException(errorMessage)
        case 502:
          throw new ScraperBrowserException(errorMessage)
        case 400:
          throw new ScraperValidationException(errorMessage)
        default:
          throw new ScraperContentExtractionException(errorMessage)
      }
    }
  }

  /**
   * Retrieves raw HTML content from a page using Playwright
   * @param request HTML request parameters
   * @returns Raw HTML content
   */
  @Post('html')
  @HttpCode(HttpStatus.OK)
  async getHtml(@Body() request: HtmlRequestDto): Promise<HtmlResponseDto> {
    try {
      this.logger.info(`Received HTML request for URL: ${request.url}`)
      const cleanupPromise = this.cleanupService.triggerCleanup()
      const resultPromise = this.scraperService.getHtml(request)
      const [, result] = await Promise.all([cleanupPromise, resultPromise])
      this.logger.info(`Successfully retrieved HTML from ${request.url}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to retrieve HTML from ${request.url}:`, error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's already a ScraperException
      if (error instanceof ScraperException) {
        throw error
      }

      // Convert to appropriate ScraperException based on error message
      const errorCode = this.getErrorCode(errorMessage)

      switch (errorCode) {
        case 504:
          throw new ScraperTimeoutException(errorMessage)
        case 502:
          throw new ScraperBrowserException(errorMessage)
        case 400:
          throw new ScraperValidationException(errorMessage)
        default:
          throw new ScraperContentExtractionException(errorMessage)
      }
    }
  }

  /**
   * Creates a new batch scraping job
   * @param request Batch job parameters
   * @returns Batch job creation response with job ID
   */
  @Post('batch')
  async createBatchJob(@Body() request: BatchRequestDto): Promise<BatchResponseDto> {
    try {
      this.logger.info(`Received batch request with ${request.items.length} items`)
      const cleanupPromise = this.cleanupService.triggerCleanup()
      const createPromise = this.batchService.createBatchJob(request)
      const [, result] = await Promise.all([cleanupPromise, createPromise])
      this.logger.info(`Created batch job: ${result.jobId}`)
      return result
    } catch (error) {
      this.logger.error('Failed to create batch job:', error)

      // Check if it's already a ScraperException
      if (error instanceof ScraperException) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new BatchJobCreationException(errorMessage)
    }
  }

  /**
   * Retrieves the status of a batch job
   * @param id Batch job ID
   * @returns Current status of the batch job
   */
  @Get('batch/:id')
  async getBatchJobStatus(@Param('id') jobId: string): Promise<BatchJobStatusDto> {
    try {
      this.logger.info(`Received status request for batch job: ${jobId}`)
      const status = await this.batchService.getBatchJobStatus(jobId)

      if (!status) {
        throw new BatchJobNotFoundException(jobId)
      }

      return status
    } catch (error) {
      this.logger.error(`Failed to get batch job status for ${jobId}:`, error)

      // Check if it's already a ScraperException
      if (error instanceof ScraperException) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new BatchJobStatusException(errorMessage)
    }
  }

  /**
   * Determines appropriate HTTP status code based on error message content
   * @param errorMessage The error message to analyze
   * @returns HTTP status code
   */
  private getErrorCode(errorMessage: string): number {
    const lowerError = errorMessage.toLowerCase()

    // Check for browser/engine errors
    if (
      lowerError.includes('browser') ||
      lowerError.includes('playwright') ||
      lowerError.includes('navigation') ||
      lowerError.includes('launch') ||
      lowerError.includes('page crashed') ||
      lowerError.includes('crashed') ||
      lowerError.includes('crash') ||
      lowerError.includes('engine')
    ) {
      return 502
    }

    // Check for timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return 504
    }

    // Check for validation errors
    if (
      lowerError.includes('validation') ||
      lowerError.includes('invalid') ||
      lowerError.includes('malformed') ||
      lowerError.includes('not valid')
    ) {
      return 400
    }

    // Default to content extraction error
    return 422
  }
}
