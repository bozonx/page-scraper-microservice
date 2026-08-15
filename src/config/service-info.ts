const DEFAULT_SERVICE_NAME = 'page-scraper-microservice'

function readOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed !== undefined && trimmed !== '' ? trimmed : fallback
}

export const SERVICE_NAME = readOr(process.env.SERVICE_NAME, DEFAULT_SERVICE_NAME)
export const SERVICE_VERSION = readOr(process.env.SERVICE_VERSION, 'dev')
