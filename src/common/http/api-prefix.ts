export function normalizeBasePath(basePath: string | undefined): string {
  return (basePath ?? '').trim().replace(/^\/+|\/+$/g, '')
}

export function buildApiPrefix(basePath: string | undefined): string {
  const normalized = normalizeBasePath(basePath)
  return normalized ? `${normalized}/api/v1` : 'api/v1'
}
