import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ScraperService } from './services/scraper.service'
import { BatchService } from './services/batch.service'
import { ScraperRequestDto } from './dto/scraper-request.dto'
import { ScraperResponseDto, ScraperErrorResponseDto } from './dto/scraper-response.dto'
import { BatchRequestDto, BatchResponseDto, BatchJobStatusDto } from './dto/batch.dto'

@Controller()
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name)

  constructor(
    private readonly scraperService: ScraperService,
    private readonly batchService: BatchService
  ) {}

  @Post('page')
  async scrapePage(@Body() request: ScraperRequestDto): Promise<ScraperResponseDto> {
    try {
      this.logger.log(`Received scrape request for URL: ${request.url}`)
      const result = await this.scraperService.scrapePage(request)
      this.logger.log(`Successfully scraped ${request.url}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to scrape ${request.url}:`, error)

      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = this.getErrorCode(errorMessage)

      // Return error response in the expected format
      const errorResponse: ScraperErrorResponseDto = {
        error: {
          code: errorCode,
          message: this.getErrorMessage(errorCode),
          details: errorMessage,
        },
      }

      throw new Error(JSON.stringify(errorResponse))
    }
  }

  @Post('batch')
  async createBatchJob(@Body() request: BatchRequestDto): Promise<BatchResponseDto> {
    try {
      this.logger.log(`Received batch request with ${request.items.length} items`)
      const result = await this.batchService.createBatchJob(request)
      this.logger.log(`Created batch job: ${result.jobId}`)
      return result
    } catch (error) {
      this.logger.error('Failed to create batch job:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Return error response
      throw new Error(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Failed to create batch job',
            details: errorMessage,
          },
        })
      )
    }
  }

  @Get('batch/:id')
  async getBatchJobStatus(@Param('id') jobId: string): Promise<BatchJobStatusDto> {
    try {
      this.logger.log(`Received status request for batch job: ${jobId}`)
      const status = await this.batchService.getBatchJobStatus(jobId)

      if (!status) {
        throw new Error(
          JSON.stringify({
            error: {
              code: 404,
              message: 'Batch job not found',
              details: `Job with ID ${jobId} does not exist or has been cleaned up`,
            },
          })
        )
      }

      return status
    } catch (error) {
      this.logger.error(`Failed to get batch job status for ${jobId}:`, error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if it's already a formatted error response
      if (errorMessage.startsWith('{')) {
        throw new Error(errorMessage)
      }

      // Return error response
      throw new Error(
        JSON.stringify({
          error: {
            code: 500,
            message: 'Failed to retrieve batch job status',
            details: errorMessage,
          },
        })
      )
    }
  }

  private getErrorCode(errorMessage: string): number {
    const lowerError = errorMessage.toLowerCase()
    
    // Check for timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return 504
    }
    
    // Check for browser/engine errors
    if (lowerError.includes('browser') || lowerError.includes('playwright') ||
        lowerError.includes('navigation') || lowerError.includes('launch')) {
      return 502
    }
    
    // Check for validation errors
    if (lowerError.includes('validation') || lowerError.includes('invalid') ||
        lowerError.includes('malformed')) {
      return 400
    }
    
    // Default to content extraction error
    return 422
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 400:
        return 'Validation error'
      case 504:
        return 'Request timeout'
      case 502:
        return 'Browser engine error'
      case 500:
        return 'Internal server error'
      default:
        return 'Failed to extract content from the page'
    }
  }
}
