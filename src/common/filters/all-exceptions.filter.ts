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

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // If it's an HttpException, return its response as-is to keep API contract
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message = this.extractMessage(exception);

      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} - ${status} - ${message}`,
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.warn(`${request.method} ${request.url} - ${status} - ${message}`);
      }

      void response.status(status).send(resp);
      return;
    }

    // Non-HttpException: build generic error wrapper
    const status = typeof (exception as { statusCode?: unknown })?.statusCode === 'number'
      ? ((exception as { statusCode: number }).statusCode as number)
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.extractMessage(exception);

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

}
