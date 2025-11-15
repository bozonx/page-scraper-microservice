import { Test, TestingModule } from '@nestjs/testing'
import { ScraperController } from '@/modules/scraper/scraper.controller'
import { ScraperService } from '@/modules/scraper/services/scraper.service'
import { BatchService } from '@/modules/scraper/services/batch.service'
import { ScraperRequestDto } from '@/modules/scraper/dto/scraper-request.dto'
import { ScraperResponseDto } from '@/modules/scraper/dto/scraper-response.dto'
import {
  BatchRequestDto,
  BatchResponseDto,
  BatchJobStatusDto,
} from '@/modules/scraper/dto/batch.dto'

describe('ScraperController', () => {
  let controller: ScraperController
  let scraperService: ScraperService
  let batchService: BatchService
  let moduleRef: TestingModule

  const mockScraperResponse: ScraperResponseDto = {
    url: 'https://example.com/article',
    title: 'Test Article',
    description: 'Test description',
    date: '2023-01-01T00:00:00.000Z',
    author: 'Test Author',
    body: '# Test Content\n\nThis is a test article',
    meta: {
      lang: 'en',
      readTimeMin: 1,
    },
  }

  const mockBatchResponse: BatchResponseDto = {
    jobId: 'b-20231115-test123',
  }

  const mockBatchStatus: BatchJobStatusDto = {
    jobId: 'b-20231115-test123',
    status: 'succeeded',
    createdAt: '2023-01-01T00:00:00.000Z',
    completedAt: '2023-01-01T00:05:00.000Z',
    total: 10,
    processed: 10,
    succeeded: 10,
    failed: 0,
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [ScraperController],
      providers: [
        {
          provide: ScraperService,
          useValue: {
            scrapePage: jest.fn(),
          },
        },
        {
          provide: BatchService,
          useValue: {
            createBatchJob: jest.fn(),
            getBatchJobStatus: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = moduleRef.get<ScraperController>(ScraperController)
    scraperService = moduleRef.get<ScraperService>(ScraperService)
    batchService = moduleRef.get<BatchService>(BatchService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('scrapePage', () => {
    const mockRequest: ScraperRequestDto = {
      url: 'https://example.com/article',
      mode: 'cheerio',
    }

    it('should return scraped content successfully', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockResolvedValue(mockScraperResponse)

      const result = await controller.scrapePage(mockRequest)

      expect(result).toEqual(mockScraperResponse)
      expect(scraperService.scrapePage).toHaveBeenCalledWith(mockRequest)
    })

    it('should throw formatted error for timeout errors', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('Request timeout'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 504,
            message: 'Request timeout',
            details: 'Request timeout',
          },
        })
      )
    })

    it('should throw formatted error for browser errors', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('Browser launch failed'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 502,
            message: 'Browser engine error',
            details: 'Browser launch failed',
          },
        })
      )
    })

    it('should throw formatted error for validation errors', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('Invalid URL format'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Validation error',
            details: 'Invalid URL format',
          },
        })
      )
    })

    it('should throw formatted error for content extraction errors', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('Could not extract article content'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 422,
            message: 'Failed to extract content from the page',
            details: 'Could not extract article content',
          },
        })
      )
    })

    it('should handle non-Error objects', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue('String error')

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 422,
            message: 'Failed to extract content from the page',
            details: 'String error',
          },
        })
      )
    })

    it('should detect timeout errors with case-insensitive matching', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('REQUEST TIMED OUT'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 504,
            message: 'Request timeout',
            details: 'REQUEST TIMED OUT',
          },
        })
      )
    })

    it('should detect browser errors with multiple keywords', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >
      mockScrapePage.mockRejectedValue(new Error('Navigation failed'))

      await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 502,
            message: 'Browser engine error',
            details: 'Navigation failed',
          },
        })
      )
    })
  })

  describe('createBatchJob', () => {
    const mockBatchRequest: BatchRequestDto = {
      items: [{ url: 'https://example.com/page1' }, { url: 'https://example.com/page2' }],
      commonSettings: {
        mode: 'cheerio',
      },
    }

    it('should create batch job successfully', async () => {
      const mockCreateBatchJob = batchService.createBatchJob as jest.MockedFunction<
        typeof batchService.createBatchJob
      >
      mockCreateBatchJob.mockResolvedValue(mockBatchResponse)

      const result = await controller.createBatchJob(mockBatchRequest)

      expect(result).toEqual(mockBatchResponse)
      expect(batchService.createBatchJob).toHaveBeenCalledWith(mockBatchRequest)
    })

    it('should throw formatted error for batch creation failures', async () => {
      const mockCreateBatchJob = batchService.createBatchJob as jest.MockedFunction<
        typeof batchService.createBatchJob
      >
      mockCreateBatchJob.mockRejectedValue(new Error('Batch size too large'))

      await expect(controller.createBatchJob(mockBatchRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Failed to create batch job',
            details: 'Batch size too large',
          },
        })
      )
    })

    it('should handle non-Error objects in batch creation', async () => {
      const mockCreateBatchJob = batchService.createBatchJob as jest.MockedFunction<
        typeof batchService.createBatchJob
      >
      mockCreateBatchJob.mockRejectedValue('String error')

      await expect(controller.createBatchJob(mockBatchRequest)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Failed to create batch job',
            details: 'String error',
          },
        })
      )
    })
  })

  describe('getBatchJobStatus', () => {
    const mockJobId = 'b-20231115-test123'

    it('should return batch job status successfully', async () => {
      const mockGetBatchJobStatus = batchService.getBatchJobStatus as jest.MockedFunction<
        typeof batchService.getBatchJobStatus
      >
      mockGetBatchJobStatus.mockResolvedValue(mockBatchStatus)

      const result = await controller.getBatchJobStatus(mockJobId)

      expect(result).toEqual(mockBatchStatus)
      expect(batchService.getBatchJobStatus).toHaveBeenCalledWith(mockJobId)
    })

    it('should throw formatted error for non-existent job', async () => {
      const mockGetBatchJobStatus = batchService.getBatchJobStatus as jest.MockedFunction<
        typeof batchService.getBatchJobStatus
      >
      mockGetBatchJobStatus.mockResolvedValue(null)

      await expect(controller.getBatchJobStatus(mockJobId)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 404,
            message: 'Batch job not found',
            details: `Job with ID ${mockJobId} does not exist or has been cleaned up`,
          },
        })
      )
    })

    it('should throw formatted error for status retrieval failures', async () => {
      const mockGetBatchJobStatus = batchService.getBatchJobStatus as jest.MockedFunction<
        typeof batchService.getBatchJobStatus
      >
      mockGetBatchJobStatus.mockRejectedValue(new Error('Database connection failed'))

      await expect(controller.getBatchJobStatus(mockJobId)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 500,
            message: 'Failed to retrieve batch job status',
            details: 'Database connection failed',
          },
        })
      )
    })

    it('should pass through already formatted error responses', async () => {
      const formattedError = JSON.stringify({
        error: {
          code: 418,
          message: 'I am a teapot',
          details: 'Custom error from service',
        },
      })

      const mockGetBatchJobStatus = batchService.getBatchJobStatus as jest.MockedFunction<
        typeof batchService.getBatchJobStatus
      >
      mockGetBatchJobStatus.mockRejectedValue(new Error(formattedError))

      await expect(controller.getBatchJobStatus(mockJobId)).rejects.toThrow(formattedError)
    })

    it('should handle non-Error objects in status retrieval', async () => {
      const mockGetBatchJobStatus = batchService.getBatchJobStatus as jest.MockedFunction<
        typeof batchService.getBatchJobStatus
      >
      mockGetBatchJobStatus.mockRejectedValue('String error')

      await expect(controller.getBatchJobStatus(mockJobId)).rejects.toThrow(
        JSON.stringify({
          error: {
            code: 500,
            message: 'Failed to retrieve batch job status',
            details: 'String error',
          },
        })
      )
    })
  })

  describe('error code detection', () => {
    const mockRequest: ScraperRequestDto = {
      url: 'https://example.com/article',
    }

    it('should detect various timeout patterns', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >

      const timeoutErrors = [
        'timeout occurred',
        'TIMED OUT',
        'Request timed out after 30 seconds',
        'Socket timeout',
      ]

      for (const error of timeoutErrors) {
        mockScrapePage.mockRejectedValueOnce(new Error(error))

        await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('504'),
          })
        )
      }
    })

    it('should detect various browser/engine patterns', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >

      const browserErrors = [
        'browser crashed',
        'Playwright launch failed',
        'Navigation timeout',
        'Page crashed',
      ]

      for (const error of browserErrors) {
        mockScrapePage.mockRejectedValueOnce(new Error(error))

        await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('502'),
          })
        )
      }
    })

    it('should detect various validation patterns', async () => {
      const mockScrapePage = scraperService.scrapePage as jest.MockedFunction<
        typeof scraperService.scrapePage
      >

      const validationErrors = [
        'validation failed',
        'Invalid input',
        'Malformed request',
        'URL is not valid',
      ]

      for (const error of validationErrors) {
        mockScrapePage.mockRejectedValueOnce(new Error(error))

        await expect(controller.scrapePage(mockRequest)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('400'),
          })
        )
      }
    })
  })
})
