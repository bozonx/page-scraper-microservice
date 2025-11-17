import { MemoryStoreService } from '@/modules/scraper/services/memory-store.service.js'
import { createMockLogger } from '@test/helpers/mocks.js'
import type { ScraperRequestDto } from '@/modules/scraper/dto/scraper-request.dto.js'
import type { ScraperResponseDto } from '@/modules/scraper/dto/scraper-response.dto.js'

describe('MemoryStoreService (unit)', () => {
  let store: MemoryStoreService

  beforeEach(() => {
    store = new MemoryStoreService(createMockLogger())
  })

  it('adds page and cleans up only records older than TTL', () => {
    const req: ScraperRequestDto = { url: 'https://example.com' } as any
    const res: ScraperResponseDto = {
      url: req.url,
      title: 't',
      description: 'd',
      date: '2024-01-01T00:00:00.000Z',
      author: 'a',
      body: 'md',
      meta: { lang: 'en', readTimeMin: 1 },
    }

    const idOld = store.addPage(req, res)
    const idYoung = store.addPage(req, res)

    // Make first record old enough to be deleted
    for (const [id, rec] of store.getPageEntries()) {
      if (id === idOld) {
        rec.createdAt = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      } else if (id === idYoung) {
        rec.createdAt = new Date(Date.now() - 1 * 60 * 1000) // 1 minute ago
      }
    }

    const removed = store.cleanupOlderThan(5 * 60 * 1000) // TTL 5 minutes

    expect(removed).toBe(1)
    // Ensure the young record remains
    const remainingIds = Array.from(store.getPageEntries()).map(([id]) => id)
    expect(remainingIds).toContain(idYoung)
    expect(remainingIds).not.toContain(idOld)
  })
})
