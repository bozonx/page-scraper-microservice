import { HttpException, HttpStatus } from '@nestjs/common'

export class ScraperException extends HttpException {
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

export class ScraperTimeoutException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.GATEWAY_TIMEOUT, 'Request timeout', details)
  }
}

export class ScraperBrowserException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.BAD_GATEWAY, 'Browser engine error', details)
  }
}

export class ScraperValidationException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.BAD_REQUEST, 'Validation error', details)
  }
}

export class ScraperContentExtractionException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'Failed to extract content from the page', details)
  }
}

export class BatchJobNotFoundException extends ScraperException {
  constructor(jobId: string) {
    super(
      HttpStatus.NOT_FOUND,
      'Batch job not found',
      `Job with ID ${jobId} does not exist or has been cleaned up`
    )
  }
}

export class BatchJobCreationException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.BAD_REQUEST, 'Failed to create batch job', details)
  }
}

export class BatchJobStatusException extends ScraperException {
  constructor(details?: string) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve batch job status', details)
  }
}
