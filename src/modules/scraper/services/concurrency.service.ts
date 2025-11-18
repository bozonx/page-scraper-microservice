import { Injectable } from '@nestjs/common'
import pLimit, { LimitFunction } from 'p-limit'

@Injectable()
export class ConcurrencyService {
  private readonly limit: LimitFunction

  constructor() {
    const max = Math.max(1, parseInt(process.env.MAX_CONCURRENCY ?? '3', 10))
    this.limit = pLimit(max)
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(fn)
  }
}
