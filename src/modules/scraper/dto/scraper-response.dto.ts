export interface ScraperMetaDto {
  lang?: string
  readTimeMin?: number
}

export interface ScraperResponseDto {
  url: string
  title?: string
  description?: string
  date?: string
  author?: string
  body?: string
  meta?: ScraperMetaDto
}

export interface ScraperErrorDto {
  code: number
  message: string
  details?: string
}

export interface ScraperErrorResponseDto {
  error: ScraperErrorDto
}
