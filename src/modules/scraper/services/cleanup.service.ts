import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { MemoryStoreService } from './memory-store.service.js'
import { BatchService } from './batch.service.js'

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private running = false
  private runningPromise: Promise<void> | null = null
  private lastRunStartedAt = 0
  private intervalHandle: NodeJS.Timeout | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryStore: MemoryStoreService,
    private readonly batchService: BatchService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(CleanupService.name)
  }

  onModuleInit(): void {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const intervalMs = scraperConfig.cleanupIntervalMins * 60 * 1000
    if (this.intervalHandle) return
    this.intervalHandle = setInterval(() => {
      void this.triggerCleanup()
    }, intervalMs)
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  triggerCleanup(): Promise<void> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!
    const minIntervalMs = scraperConfig.cleanupIntervalMins * 60 * 1000
    const now = Date.now()

    if (this.running) {
      return this.runningPromise!
    }

    if (now - this.lastRunStartedAt < minIntervalMs) {
      return Promise.resolve()
    }

    this.running = true
    this.lastRunStartedAt = now

    const ttlMs = scraperConfig.dataLifetimeMins * 60 * 1000

    this.runningPromise = (async () => {
      try {
        // Ensure we handle both sync and async implementations
        const removedPages = await Promise.resolve(
          this.memoryStore.cleanupOlderThan(ttlMs)
        )
        const removedJobs = await Promise.resolve(this.batchService.cleanupOlderThan(ttlMs))
        this.logger.debug(
          `Cleanup completed: removed ${removedPages} page records, ${removedJobs} batch jobs`
        )
      } catch (err) {
        this.logger.error('Cleanup failed', err)
      } finally {
        this.running = false
        this.runningPromise = null
      }
    })()

    return this.runningPromise
  }
}
