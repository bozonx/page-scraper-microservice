import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import pLimit, { LimitFunction } from 'p-limit'
import type { ScraperConfig } from '../../../config/scraper.config.js'

@Injectable()
export class ConcurrencyService {
  private readonly limit: LimitFunction

  constructor(private readonly configService: ConfigService) {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const configuredMax = scraperConfig?.globalMaxConcurrency ?? 3
    const max = Math.max(1, configuredMax)
    this.limit = pLimit(max)
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(fn)
  }
}
