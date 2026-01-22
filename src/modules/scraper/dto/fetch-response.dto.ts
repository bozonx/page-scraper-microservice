export interface FetchResponseMetaDto {
  durationMs: number
  engine: 'http' | 'playwright'
  attempts: number
  wasAntibot: boolean
  statusCode?: number
  responseHeaders?: Record<string, string>
}

export interface FetchErrorDto {
  code: string
  message: string
  retryable: boolean
  stack?: string
}

export interface FetchResponseDto {
  finalUrl: string
  content: string
  detectedContentType?: string
  meta: FetchResponseMetaDto
}

export interface FetchErrorResponseDto {
  finalUrl?: string
  meta: FetchResponseMetaDto
  error: FetchErrorDto
}
