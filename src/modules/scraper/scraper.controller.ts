import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from './services/scraper.service'
import { BatchService } from './services/batch.service'
import { ScraperRequestDto } from './dto/scraper-request.dto'
import { ScraperResponseDto, ScraperErrorResponseDto } from './dto/scraper-response.dto'
import { BatchRequestDto, BatchResponseDto, BatchJobStatusDto } from './dto/batch.dto'
import {
  ScraperException,
  ScraperTimeoutException,
  ScraperBrowserException,
  ScraperValidationException,
  ScraperContentExtractionException,
  BatchJobNotFoundException,
  BatchJobCreationException,
  BatchJobStatusException,
} from '@common/exceptions/scraper.exception'

@Controller()
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly batchService: BatchService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ScraperController.name)
  }

  @Post('page')
  @HttpCode(HttpStatus.OK)
  async scrapePage(@Body() request: ScraperRequestDto): Promise<ScraperResponseDto> {
    try {
      this.logger.info(`Received scrape request for URL: ${request.url}`)
      const result = await this.scraperService.scrapePage(request)
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

  @Post('batch')
  async createBatchJob(@Body() request: BatchRequestDto): Promise<BatchResponseDto> {
    try {
      this.logger.info(`Received batch request with ${request.items.length} items`)
      const result = await this.batchService.createBatchJob(request)
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
