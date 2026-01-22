import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'

export interface SsrfGuardOptions {
  allowLocalhost?: boolean
}

const IPV4_PRIVATE_RANGES: Array<{ from: number; to: number }> = [
  // 10.0.0.0/8
  { from: ipV4ToInt('10.0.0.0'), to: ipV4ToInt('10.255.255.255') },
  // 172.16.0.0/12
  { from: ipV4ToInt('172.16.0.0'), to: ipV4ToInt('172.31.255.255') },
  // 192.168.0.0/16
  { from: ipV4ToInt('192.168.0.0'), to: ipV4ToInt('192.168.255.255') },
  // 127.0.0.0/8
  { from: ipV4ToInt('127.0.0.0'), to: ipV4ToInt('127.255.255.255') },
  // 169.254.0.0/16 (link-local, includes metadata range)
  { from: ipV4ToInt('169.254.0.0'), to: ipV4ToInt('169.254.255.255') },
  // 0.0.0.0/8
  { from: ipV4ToInt('0.0.0.0'), to: ipV4ToInt('0.255.255.255') },
]

function ipV4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p))
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function isIpv4Blocked(ip: string, opts: SsrfGuardOptions): boolean {
  const allowLocalhost = opts.allowLocalhost === true
  const ipInt = ipV4ToInt(ip)

  for (const range of IPV4_PRIVATE_RANGES) {
    if (ipInt >= range.from && ipInt <= range.to) {
      if (allowLocalhost) {
        // Allow only 127.0.0.0/8 when explicitly allowed for tests/dev.
        const localhostFrom = ipV4ToInt('127.0.0.0')
        const localhostTo = ipV4ToInt('127.255.255.255')
        if (ipInt >= localhostFrom && ipInt <= localhostTo) {
          return false
        }
      }
      return true
    }
  }

  return false
}

function isIpv6Blocked(ip: string, opts: SsrfGuardOptions): boolean {
  const allowLocalhost = opts.allowLocalhost === true
  const normalized = ip.toLowerCase()

  if (allowLocalhost && (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1')) {
    return false
  }

  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
  // Link-local fe80::/10
  if (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true
  }
  // Unique local fc00::/7
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true

  return false
}

export async function assertUrlAllowed(url: string, opts: SsrfGuardOptions = {}): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported URL protocol')
  }

  const hostname = parsed.hostname

  const ipType = isIP(hostname)
  if (ipType === 4) {
    if (isIpv4Blocked(hostname, opts)) {
      throw new Error('SSRF blocked')
    }
    return parsed
  }
  if (ipType === 6) {
    if (isIpv6Blocked(hostname, opts)) {
      throw new Error('SSRF blocked')
    }
    return parsed
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length) {
    throw new Error('DNS lookup failed')
  }

  for (const addr of addresses) {
    if (addr.family === 4) {
      if (isIpv4Blocked(addr.address, opts)) throw new Error('SSRF blocked')
    } else if (addr.family === 6) {
      if (isIpv6Blocked(addr.address, opts)) throw new Error('SSRF blocked')
    }
  }

  return parsed
}
