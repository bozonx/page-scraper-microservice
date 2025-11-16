import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global exception filter that catches all exceptions
 * and formats them in a consistent way for Fastify responses
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    logger.setContext(AllExceptionsFilter.name);
  }

  /**
   * Catches and handles all exceptions thrown in the application
   * @param exception The exception that was thrown
   * @param host The arguments host containing request/response context
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // If it's an HttpException, return its response as-is to keep API contract
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message = this.extractMessage(exception);

      // Log server errors differently than client errors
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} - ${status} - ${message}`,
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
      }

      // Normalize validation errors (BadRequest from ValidationPipe) to unified envelope
      if (status === HttpStatus.BAD_REQUEST) {
        const details = this.extractValidationDetails(resp);
        void response.status(status).send({
          error: {
            code: status,
            message: 'Validation failed',
            details,
          },
        });
        return;
      }

      void response.status(status).send(resp);
      return;
    }

    // Non-HttpException: build generic error wrapper
    const status = typeof (exception as { statusCode?: unknown })?.statusCode === 'number'
      ? ((exception as { statusCode: number }).statusCode as number)
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.extractMessage(exception);

    // Log server errors differently than client errors
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
    }

    void response.status(status).send({
      error: {
        code: status,
        message,
      },
    });
  }

  /**
   * Extracts a meaningful error message from various exception types
   * @param exception The exception to extract message from
   * @returns A string error message
   */
  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const msg = (response as { message: unknown }).message;
        if (Array.isArray(msg)) {
          return msg.join(', ');
        }
        if (typeof msg === 'string') {
          return msg;
        }
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  /**
   * Extracts validation error details from validation error responses
   * @param resp The response object from validation
   * @returns Array of validation error messages or undefined
   */
  private extractValidationDetails(resp: unknown): string[] | undefined {
    if (typeof resp === 'string') return [resp];
    if (typeof resp === 'object' && resp !== null) {
      const obj = resp as { message?: unknown; error?: unknown };
      if (Array.isArray(obj.message)) {
        return obj.message as string[];
      }
      if (typeof obj.message === 'string') {
        return [obj.message as string];
      }
    }
    return undefined;
  }

}