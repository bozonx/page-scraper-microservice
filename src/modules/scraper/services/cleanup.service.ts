import { Injectable, OnModuleDestroy, OnModuleInit, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { MemoryStoreService } from './memory-store.service.js'

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private running = false
  private runningPromise: Promise<void> | null = null
  private lastRunStartedAt = 0
  private intervalHandle: NodeJS.Timeout | null = null

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryStore: MemoryStoreService,
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

  async onApplicationShutdown(_signal?: string): Promise<void> {
    // Wait for active cleanup to complete
    if (this.runningPromise) {
      this.logger.info('Waiting for cleanup to complete...')
      await this.runningPromise
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
        const removedPages = await Promise.resolve(this.memoryStore.cleanupOlderThan(ttlMs))
        this.logger.debug(`Cleanup completed: removed ${removedPages} page records`)
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
