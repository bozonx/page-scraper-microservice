import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import { v4 as uuidv4 } from 'uuid'
import { ScraperRequestDto } from '../dto/scraper-request.dto'
import { ScraperResponseDto } from '../dto/scraper-response.dto'

export interface StoredPageRecord {
  id: string
  request: ScraperRequestDto
  response: ScraperResponseDto
  createdAt: Date
}

@Injectable()
export class MemoryStoreService {
  private readonly pages = new Map<string, StoredPageRecord>()

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MemoryStoreService.name)
  }

  addPage(request: ScraperRequestDto, response: ScraperResponseDto): string {
    const id = uuidv4()
    const record: StoredPageRecord = { id, request, response, createdAt: new Date() }
    this.pages.set(id, record)
    this.logger.debug(`Stored page ${id} for ${request.url ?? 'unknown URL'}`)
    return id
  }

  getPageEntries(): IterableIterator<[string, StoredPageRecord]> {
    return this.pages.entries()
  }

  deletePage(id: string): void {
    if (this.pages.delete(id)) {
      this.logger.debug(`Deleted stored page ${id}`)
    }
  }

  clearAllPages(): void {
    const count = this.pages.size
    this.pages.clear()
    if (count > 0) {
      this.logger.debug(`Cleared ${count} stored page records`)
    }
  }

  cleanupOlderThan(ttlMs: number): number {
    const now = Date.now()
    let removed = 0
    for (const [id, rec] of this.pages.entries()) {
      if (now - rec.createdAt.getTime() >= ttlMs) {
        this.pages.delete(id)
        removed++
      }
    }
    if (removed > 0) {
      this.logger.debug(`Removed ${removed} stored page records older than ${ttlMs}ms`)
    }
    return removed
  }
}
