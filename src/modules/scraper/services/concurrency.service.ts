import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import pLimit, { LimitFunction } from 'p-limit'
import type { ScraperConfig } from '../../../config/scraper.config.js'

@Injectable()
export class ConcurrencyService implements OnApplicationShutdown {
  private readonly limit: LimitFunction

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ConcurrencyService.name)
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const configuredMax = scraperConfig?.globalMaxConcurrency ?? 3
    const max = Math.max(1, configuredMax)
    this.limit = pLimit(max)
  }

  run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new Error('Request aborted'))
    }
    return this.limit(async () => {
      if (signal?.aborted) {
        throw new Error('Request aborted')
      }
      return fn()
    })
  }

  async onApplicationShutdown(_signal?: string): Promise<void> {
    this.logger.info('Clearing pending tasks queue...')
    this.limit.clearQueue()
  }
}
