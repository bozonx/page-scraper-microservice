import { Injectable } from '@nestjs/common'
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

  addPage(request: ScraperRequestDto, response: ScraperResponseDto): string {
    const id = uuidv4()
    const record: StoredPageRecord = { id, request, response, createdAt: new Date() }
    this.pages.set(id, record)
    return id
  }

  getPageEntries(): IterableIterator<[string, StoredPageRecord]> {
    return this.pages.entries()
  }

  deletePage(id: string): void {
    this.pages.delete(id)
  }

  clearAllPages(): void {
    this.pages.clear()
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
    return removed
  }
}
