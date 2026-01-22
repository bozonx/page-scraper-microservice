import { HttpException, HttpStatus, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import pLimit, { LimitFunction } from 'p-limit'
import type { ScraperConfig } from '../../../config/scraper.config.js'

@Injectable()
export class ConcurrencyService implements OnApplicationShutdown {
  private readonly globalLimit: LimitFunction
  private readonly browserLimit: LimitFunction
  private readonly globalMaxQueue: number
  private readonly browserMaxQueue: number

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ConcurrencyService.name)
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')

    const configuredGlobalMax = scraperConfig?.globalMaxConcurrency ?? 3
    const globalMax = Math.max(1, configuredGlobalMax)
    this.globalLimit = pLimit(globalMax)

    this.globalMaxQueue = Math.max(0, scraperConfig?.globalMaxQueue ?? 100)

    const configuredBrowserMax = scraperConfig?.browserMaxConcurrency ?? 1
    const browserMax = Math.max(1, configuredBrowserMax)
    this.browserLimit = pLimit(browserMax)

    this.browserMaxQueue = Math.max(0, scraperConfig?.browserMaxQueue ?? 50)
  }

  private assertQueueNotFull(args: { type: 'global' | 'browser' }): void {
    const limit = args.type === 'browser' ? this.browserLimit : this.globalLimit
    const maxQueue = args.type === 'browser' ? this.browserMaxQueue : this.globalMaxQueue

    if (maxQueue === 0) {
      // 0 means do not queue at all, only allow immediate execution.
      if (limit.activeCount > 0 || limit.pendingCount > 0) {
        throw new HttpException(
          {
            error: {
              code: HttpStatus.TOO_MANY_REQUESTS,
              message: 'Service is busy',
              details: `${args.type} queue is disabled`,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS
        )
      }
      return
    }

    if (limit.pendingCount >= maxQueue) {
      throw new HttpException(
        {
          error: {
            code: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Service is busy',
            details: `${args.type} queue is full`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      )
    }
  }

  run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new Error('Request aborted'))
    }

    this.assertQueueNotFull({ type: 'global' })

    return this.globalLimit(async () => {
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }
      return fn()
    })
  }

  runBrowser<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    this.assertQueueNotFull({ type: 'browser' })
    return this.run(() => this.browserLimit(fn), signal)
  }

  async onApplicationShutdown(_signal?: string): Promise<void> {
    this.logger.info('Clearing pending tasks queue...')
    this.globalLimit.clearQueue()
    this.browserLimit.clearQueue()
  }
}
