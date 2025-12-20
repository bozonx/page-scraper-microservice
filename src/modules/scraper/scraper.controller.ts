import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from './services/scraper.service.js'
import { BatchService } from './services/batch.service.js'
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
} from '../../common/exceptions/scraper.exception.js'
import { ShutdownGuard } from '../../common/guards/shutdown.guard.js'
import { ShutdownService } from '../../common/services/shutdown.service.js'

/**
 * Scraper controller
 * Handles HTTP requests for web scraping operations and batch job management
 */
@UseGuards(ShutdownGuard)
@Controller()
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly batchService: BatchService,
    private readonly memoryStoreService: MemoryStoreService,
    private readonly shutdownService: ShutdownService,
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
  async scrapePage(@Body() request: ScraperRequestDto, @Req() req: FastifyRequest): Promise<ScraperResponseDto> {
    this.shutdownService.incrementActiveRequests()
    const ac = new AbortController()
    const onDisconnect = () => {
      this.logger.warn(`Client disconnected for ${request.url}`)
      ac.abort()
    }
    req.raw.on('close', onDisconnect)

    try {
      this.logger.info(`Received scrape request for URL: ${request.url}`)
      const result = await this.scraperService
        .scrapePage(request, ac.signal)
        .then((res: ScraperResponseDto) => {
          this.memoryStoreService.addPage(request, res)
          return res
        })
      this.logger.info(`Successfully scraped ${request.url}`)
      return result
    } catch (error) {
      if (ac.signal.aborted) {
        this.logger.warn(`Request aborted for ${request.url}`)
      } else {
        this.logger.error(`Failed to scrape ${request.url}:`, error)
      }
      throw this.handleScraperError(error)
    } finally {
      req.raw.off('close', onDisconnect)
      this.shutdownService.decrementActiveRequests()
    }
  }

  /**
   * Retrieves raw HTML content from a page using Playwright
   * @param request HTML request parameters
   * @returns Raw HTML content
   */
  @Post('html')
  @HttpCode(HttpStatus.OK)
  async getHtml(@Body() request: HtmlRequestDto, @Req() req: FastifyRequest): Promise<HtmlResponseDto> {
    this.shutdownService.incrementActiveRequests()
    const ac = new AbortController()
    const onDisconnect = () => {
      this.logger.warn(`Client disconnected for html ${request.url}`)
      ac.abort()
    }
    req.raw.on('close', onDisconnect)

    try {
      this.logger.info(`Received HTML request for URL: ${request.url}`)
      const result = await this.scraperService.getHtml(request, ac.signal)
      this.logger.info(`Successfully retrieved HTML from ${request.url}`)
      return result
    } catch (error) {
      if (ac.signal.aborted) {
        this.logger.warn(`Request aborted for html ${request.url}`)
      } else {
        this.logger.error(`Failed to retrieve HTML from ${request.url}:`, error)
      }
      throw this.handleScraperError(error)
    } finally {
      req.raw.off('close', onDisconnect)
      this.shutdownService.decrementActiveRequests()
    }
  }

  /**
   * Creates a new batch scraping job
   * @param request Batch job parameters
   * @returns Batch job creation response with job ID
   */
  @Post('batch')
  async createBatchJob(@Body() request: BatchRequestDto): Promise<BatchResponseDto> {
    this.shutdownService.incrementActiveRequests()
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
    } finally {
      this.shutdownService.decrementActiveRequests()
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
   * Handles errors from scraper service and converts them to appropriate exceptions
   * @param error Error to handle
   * @returns ScraperException
   */
  private handleScraperError(error: unknown): ScraperException {
    return ScraperException.fromUnknown(error)
  }
}
