import { CleanupService } from '@/modules/scraper/services/cleanup.service.js'
import { MemoryStoreService } from '@/modules/scraper/services/memory-store.service.js'
import { BatchService } from '@/modules/scraper/services/batch.service.js'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { createMockConfigService, createMockLogger } from '@test/helpers/mocks.js'

describe('CleanupService (unit)', () => {
  let cleanup: CleanupService
  let memoryStore: jest.Mocked<MemoryStoreService>
  let batchService: jest.Mocked<BatchService>
  let configService: ConfigService
  let logger: PinoLogger

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    memoryStore = {
      cleanupOlderThan: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<MemoryStoreService>

    batchService = {
      cleanupOlderThan: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<BatchService>

    configService = createMockConfigService({
      scraper: {
        dataLifetimeMins: 60,
        cleanupIntervalMins: 5,
      },
    }) as unknown as ConfigService
    logger = createMockLogger()

    cleanup = new CleanupService(configService, memoryStore, batchService, logger)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('runs cleanup with TTL derived from config', async () => {
    await cleanup.triggerCleanup()
    // 60 minutes -> milliseconds
    expect(memoryStore.cleanupOlderThan).toHaveBeenCalledWith(60 * 60 * 1000)
    expect(batchService.cleanupOlderThan).toHaveBeenCalledWith(60 * 60 * 1000)
  })

  it('throttles repeated runs within CLEANUP_INTERVAL_MINS', async () => {
    const p1 = cleanup.triggerCleanup()
    await p1
    const p2 = cleanup.triggerCleanup()
    await p2

    expect(memoryStore.cleanupOlderThan).toHaveBeenCalledTimes(1)
    expect(batchService.cleanupOlderThan).toHaveBeenCalledTimes(1)
  })

  it('returns the same promise if a cleanup is already running', async () => {
    const deferred: { resolve: () => void; promise: Promise<number> } = (() => {
      let resolve!: () => void
      const promise = new Promise<number>((res) => {
        resolve = () => res(0)
      })
      return { resolve, promise }
    })()

    memoryStore.cleanupOlderThan.mockImplementationOnce(() => 0)
    batchService.cleanupOlderThan.mockImplementationOnce(() => deferred.promise as any)

    const p1 = cleanup.triggerCleanup()
    const p2 = cleanup.triggerCleanup()
    expect(p2).toBe(p1)

    deferred.resolve()
    await p1
  })
})
