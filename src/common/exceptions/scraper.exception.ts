import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Base scraper exception class
 * Provides a consistent error format for all scraper-related errors
 */
export class ScraperException extends HttpException {
  /**
   * Creates a new scraper exception
   * @param code HTTP status code
   * @param message Error message
   * @param details Optional detailed error information
   */
  constructor(code: number, message: string, details?: string) {
    super(
      {
        error: {
          code,
          message,
          details,
        },
      },
      code
    )
  }
}

/**
 * Exception thrown when a scraping operation times out
 */
export class ScraperTimeoutException extends ScraperException {
  /**
   * Creates a new timeout exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.GATEWAY_TIMEOUT, 'Request timeout', details)
  }
}

/**
 * Exception thrown when browser engine encounters an error
 */
export class ScraperBrowserException extends ScraperException {
  /**
   * Creates a new browser exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.BAD_GATEWAY, 'Browser engine error', details)
  }
}

/**
 * Exception thrown when request validation fails
 */
export class ScraperValidationException extends ScraperException {
  /**
   * Creates a new validation exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.BAD_REQUEST, 'Validation error', details)
  }
}

/**
 * Exception thrown when content extraction from a page fails
 */
export class ScraperContentExtractionException extends ScraperException {
  /**
   * Creates a new content extraction exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'Failed to extract content from the page', details)
  }
}

/**
 * Exception thrown when a batch job is not found
 */
export class BatchJobNotFoundException extends ScraperException {
  /**
   * Creates a new batch job not found exception
   * @param jobId The ID of the job that was not found
   */
  constructor(jobId: string) {
    super(
      HttpStatus.NOT_FOUND,
      'Batch job not found',
      `Job with ID ${jobId} does not exist or has been cleaned up`
    )
  }
}

/**
 * Exception thrown when batch job creation fails
 */
export class BatchJobCreationException extends ScraperException {
  /**
   * Creates a new batch job creation exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.BAD_REQUEST, 'Failed to create batch job', details)
  }
}

/**
 * Exception thrown when retrieving batch job status fails
 */
export class BatchJobStatusException extends ScraperException {
  /**
   * Creates a new batch job status exception
   * @param details Optional detailed error information
   */
  constructor(details?: string) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve batch job status', details)
  }
}