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
  /**
   * Converts any error into a ScraperException
   * @param error The error to convert
   * @returns ScraperException
   */
  static fromUnknown(error: unknown): ScraperException {
    // Check if it's already a ScraperException
    if (error instanceof ScraperException) {
      return error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
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
      return new ScraperBrowserException(errorMessage)
    }

    // Check for timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return new ScraperTimeoutException(errorMessage)
    }

    // Check for validation errors
    if (
      lowerError.includes('validation') ||
      lowerError.includes('invalid') ||
      lowerError.includes('malformed') ||
      lowerError.includes('not valid')
    ) {
      return new ScraperValidationException(errorMessage)
    }

    // Default to content extraction error
    return new ScraperContentExtractionException(errorMessage)
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
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'Failed to extract content from page', details)
  }
}
