import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  HttpException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { FastifyReply } from 'fastify'
import { PinoLogger } from 'nestjs-pino'
import { ScraperService } from './services/scraper.service.js'
import { FetchService } from './services/fetch.service.js'
import { FileService } from './services/file.service.js'
import { MemoryStoreService } from './services/memory-store.service.js'
import { ScraperRequestDto } from './dto/scraper-request.dto.js'
import { ScraperResponseDto } from './dto/scraper-response.dto.js'
import { FetchRequestDto } from './dto/fetch-request.dto.js'
import type { FetchResponseDto } from './dto/fetch-response.dto.js'
import { FileRequestDto } from './dto/file-request.dto.js'
import { ScraperException } from '../../common/exceptions/scraper.exception.js'
import { ShutdownGuard } from '../../common/guards/shutdown.guard.js'
import { ShutdownService } from '../../common/services/shutdown.service.js'

/**
 * Scraper controller
 * Handles HTTP requests for web scraping operations
 */
@UseGuards(ShutdownGuard)
@Controller()
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly fetchService: FetchService,
    private readonly fileService: FileService,
    private readonly memoryStoreService: MemoryStoreService,
    private readonly shutdownService: ShutdownService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ScraperController.name)
  }

  private async withAbortableRequest<T>(
    args: {
      req: FastifyRequest
      url: string
      opName: string
    },
    fn: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    this.shutdownService.incrementActiveRequests()

    const ac = new AbortController()
    const onDisconnect = () => {
      this.logger.warn(`Client disconnected for ${args.opName} ${args.url}`)
      ac.abort()
    }

    args.req.raw.on('close', onDisconnect)

    try {
      return await fn(ac.signal)
    } catch (error) {
      if (ac.signal.aborted) {
        this.logger.warn(`Request aborted for ${args.opName} ${args.url}`)
      }
      throw error
    } finally {
      args.req.raw.off('close', onDisconnect)
      this.shutdownService.decrementActiveRequests()
    }
  }

  @Post('file')
  async file(
    @Body() request: FileRequestDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply
  ) {
    return await this.withAbortableRequest(
      {
        req,
        url: request.url,
        opName: 'file',
      },
      async (signal) => {
        try {
          this.logger.info(`Received file proxy request for URL: ${request.url}`)
          const result = await this.fileService.proxyFile(request, signal)

          reply.status(result.statusCode)
          for (const [k, v] of Object.entries(result.headers)) {
            if (typeof v === 'string' && v.length > 0) {
              reply.header(k, v)
            }
          }
          reply.header('X-Final-Url', result.finalUrl)
          reply.header('X-Mode-Used', result.modeUsed)
          return reply.send(result.stream)
        } catch (error) {
          if (!signal.aborted) {
            this.logger.error(`Failed to proxy file ${request.url}:`, error)
          }

          if (error instanceof HttpException) {
            throw error
          }

          throw this.handleScraperError(error)
        }
      }
    )
  }

  /**
   * Scrapes a single page and extracts its content
   * @param request Scraper request parameters
   * @returns Extracted page content
   */
  @Post('page')
  @HttpCode(HttpStatus.OK)
  async scrapePage(
    @Body() request: ScraperRequestDto,
    @Req() req: FastifyRequest
  ): Promise<ScraperResponseDto> {
    return await this.withAbortableRequest(
      {
        req,
        url: request.url,
        opName: 'page',
      },
      async (signal) => {
        try {
          this.logger.info(`Received scrape request for URL: ${request.url}`)
          const result = await this.scraperService
            .scrapePage(request, signal)
            .then((res: ScraperResponseDto) => {
              this.memoryStoreService.addPage(request, res)
              return res
            })
          this.logger.info(`Successfully scraped ${request.url}`)
          return result
        } catch (error) {
          if (!signal.aborted) {
            this.logger.error(`Failed to scrape ${request.url}:`, error)
          }
          throw this.handleScraperError(error)
        }
      }
    )
  }

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetch(
    @Body() request: FetchRequestDto,
    @Req() req: FastifyRequest
  ): Promise<FetchResponseDto> {
    return await this.withAbortableRequest(
      {
        req,
        url: request.url,
        opName: 'fetch',
      },
      async (signal) => {
        try {
          this.logger.info(`Received fetch request for URL: ${request.url}`)
          const result = await this.fetchService.fetch(request, signal)
          this.logger.info(`Successfully fetched ${request.url}`)
          return result
        } catch (error) {
          if (!signal.aborted) {
            this.logger.error(`Failed to fetch ${request.url}:`, error)
          }

          if (error instanceof HttpException) {
            throw error
          }

          throw this.handleScraperError(error)
        }
      }
    )
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
