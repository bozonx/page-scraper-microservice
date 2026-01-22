import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { fetch } from 'undici'
import { Readable, Transform } from 'node:stream'
import { assertUrlAllowed } from '../../../utils/ssrf.util.js'
import type { ScraperConfig } from '../../../config/scraper.config.js'
import { ConcurrencyService } from './concurrency.service.js'
import { BrowserService } from './browser.service.js'
import { FingerprintService } from './fingerprint.service.js'
import { FileRequestDto } from '../dto/file-request.dto.js'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function sanitizeUpstreamRequestHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  if (!headers) return {}
  const out: Record<string, string> = {}

  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    if (key === 'host') continue
    if (key === 'content-length') continue
    if (v == null) continue
    out[k] = String(v)
  }

  return out
}

function sanitizeUpstreamResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    if (key === 'set-cookie') continue
    if (key === 'content-encoding') {
      // Avoid mismatched content-encoding if the client/framework changes the body handling
      // We stream as-is, but leaving it may break clients if something tampers with the stream.
      // Keeping it removed is safer.
      continue
    }
    out[k] = v
  }

  return out
}

class ByteLimitTransform extends Transform {
  private total = 0

  constructor(private readonly maxBytes: number) {
    super()
  }

  public override _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null, data?: any) => void
  ) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    this.total += buf.length
    if (this.total > this.maxBytes) {
      callback(new Error('Response too large'))
      return
    }
    callback(null, buf)
  }
}

export interface FileProxyResult {
  statusCode: number
  finalUrl: string
  headers: Record<string, string>
  stream: Readable
  modeUsed: 'http' | 'playwright'
}

@Injectable()
export class FileService {
  constructor(
    private readonly configService: ConfigService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly browserService: BrowserService,
    private readonly fingerprintService: FingerprintService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(FileService.name)
  }

  public async proxyFile(
    requestDto: FileRequestDto,
    signal?: AbortSignal
  ): Promise<FileProxyResult> {
    const mode = requestDto.mode ?? 'auto'

    if (mode === 'playwright') {
      return await this.concurrencyService.run(
        async () => this.playwrightDownload(requestDto, signal),
        signal
      )
    }

    if (mode === 'http') {
      return await this.concurrencyService.run(
        async () => this.httpDownload(requestDto, signal),
        signal
      )
    }

    return await this.concurrencyService.run(async () => {
      const res = await this.httpDownload(requestDto, signal)
      if (res.statusCode === 403 || res.statusCode === 429) {
        this.logger.warn(`Anti-bot suspected for ${requestDto.url}, falling back to Playwright`)
        try {
          return await this.playwrightDownload(requestDto, signal)
        } catch (err) {
          return res
        }
      }
      return res
    }, signal)
  }

  private getMaxBytes(requestDto: FileRequestDto): number {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const configured = Math.max(1, scraperConfig?.fileMaxResponseBytes ?? 25 * 1024 * 1024)

    if (typeof requestDto.maxBytes === 'number' && Number.isFinite(requestDto.maxBytes)) {
      return Math.max(1, Math.min(configured, requestDto.maxBytes))
    }

    return configured
  }

  private getTimeoutMs(requestDto: FileRequestDto): number {
    const timeoutSecs = requestDto.timeoutSecs ?? 60
    return Math.max(1, timeoutSecs) * 1000
  }

  private async httpDownload(
    requestDto: FileRequestDto,
    signal?: AbortSignal
  ): Promise<FileProxyResult> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const allowLocalhost = process.env.NODE_ENV === 'test'

    const maxRedirects = Math.max(0, scraperConfig?.fileMaxRedirects ?? 7)
    const timeoutMs = this.getTimeoutMs(requestDto)
    const deadlineMs = Date.now() + timeoutMs

    const maxBytes = this.getMaxBytes(requestDto)

    let currentUrl = requestDto.url
    let redirects = 0

    while (true) {
      const validated = await assertUrlAllowed(currentUrl, { allowLocalhost })

      const controller = new AbortController()
      const onAbort = () => controller.abort()
      signal?.addEventListener('abort', onAbort)

      const remainingMs = Math.max(0, deadlineMs - Date.now())
      if (remainingMs <= 0) {
        signal?.removeEventListener('abort', onAbort)
        throw this.httpError('FILE_TIMEOUT', 'Request timeout', HttpStatus.GATEWAY_TIMEOUT)
      }

      const timeout = setTimeout(() => controller.abort(), remainingMs)

      try {
        const res = await fetch(validated.toString(), {
          method: 'GET',
          headers: sanitizeUpstreamRequestHeaders(requestDto.headers),
          redirect: 'manual',
          signal: controller.signal,
        })

        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          if (redirects >= maxRedirects) {
            throw this.httpError(
              'FILE_TOO_MANY_REDIRECTS',
              'Too many redirects',
              HttpStatus.LOOP_DETECTED
            )
          }
          redirects += 1
          const location = String(res.headers.get('location'))
          currentUrl = new URL(location, validated).toString()
          continue
        }

        const responseHeaders: Record<string, string> = {}
        for (const [k, v] of (res.headers as any).entries()) {
          responseHeaders[k] = String(v)
        }

        const contentLengthHeader = res.headers.get('content-length')
        if (typeof contentLengthHeader === 'string') {
          const parsed = Number(contentLengthHeader)
          if (Number.isFinite(parsed) && parsed > maxBytes) {
            throw this.httpError(
              'FILE_RESPONSE_TOO_LARGE',
              'Response too large',
              HttpStatus.PAYLOAD_TOO_LARGE
            )
          }
        }

        if (!res.body) {
          throw this.httpError(
            'FILE_EMPTY_RESPONSE',
            'Empty upstream response',
            HttpStatus.BAD_GATEWAY
          )
        }

        const upstream = Readable.fromWeb(res.body as any)
        const limiter = new ByteLimitTransform(maxBytes)
        const stream = upstream.pipe(limiter)

        const filteredHeaders = sanitizeUpstreamResponseHeaders(responseHeaders)

        return {
          statusCode: res.status,
          finalUrl: validated.toString(),
          headers: filteredHeaders,
          stream,
          modeUsed: 'http',
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw this.httpError('FILE_TIMEOUT', 'Request timeout', HttpStatus.GATEWAY_TIMEOUT)
        }

        if (err instanceof HttpException) {
          throw err
        }

        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('ssrf blocked')) {
          throw this.httpError('FILE_SSRF_BLOCKED', 'SSRF blocked', HttpStatus.BAD_REQUEST)
        }

        if (msg.toLowerCase().includes('response too large')) {
          throw this.httpError(
            'FILE_RESPONSE_TOO_LARGE',
            'Response too large',
            HttpStatus.PAYLOAD_TOO_LARGE
          )
        }

        throw this.httpError('FILE_ERROR', msg, HttpStatus.BAD_GATEWAY)
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
      }
    }
  }

  private async playwrightDownload(
    requestDto: FileRequestDto,
    signal?: AbortSignal
  ): Promise<FileProxyResult> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const allowLocalhost = process.env.NODE_ENV === 'test'

    const validatedUrl = await assertUrlAllowed(requestDto.url, { allowLocalhost })
    const navigationTimeoutMs =
      Math.max(1, scraperConfig?.playwrightNavigationTimeoutSecs ?? 60) * 1000

    const maxBytes = this.getMaxBytes(requestDto)

    const fp = this.fingerprintService.generateFingerprint({})

    return await this.browserService.withPage(
      async (page) => {
        const headers = sanitizeUpstreamRequestHeaders(requestDto.headers)
        if (Object.keys(headers).length > 0) {
          await page.setExtraHTTPHeaders(headers)
        }

        const response = await page.request.get(validatedUrl.toString(), {
          timeout: Math.min(this.getTimeoutMs(requestDto), navigationTimeoutMs),
        })

        const responseHeaders = response.headers()
        const filteredHeaders = sanitizeUpstreamResponseHeaders(
          Object.fromEntries(Object.entries(responseHeaders).map(([k, v]) => [k, String(v)]))
        )

        const contentLength = responseHeaders['content-length']
        if (typeof contentLength === 'string') {
          const parsed = Number(contentLength)
          if (Number.isFinite(parsed) && parsed > maxBytes) {
            throw this.httpError(
              'FILE_RESPONSE_TOO_LARGE',
              'Response too large',
              HttpStatus.PAYLOAD_TOO_LARGE
            )
          }
        }

        const buf = await response.body()
        if (buf.byteLength > maxBytes) {
          throw this.httpError(
            'FILE_RESPONSE_TOO_LARGE',
            'Response too large',
            HttpStatus.PAYLOAD_TOO_LARGE
          )
        }

        const stream = Readable.from(buf)

        return {
          statusCode: response.status(),
          finalUrl: validatedUrl.toString(),
          headers: filteredHeaders,
          stream,
          modeUsed: 'playwright',
        }
      },
      fp,
      signal
    )
  }

  private httpError(code: string, message: string, status: HttpStatus): HttpException {
    return new HttpException(
      {
        error: {
          code,
          message,
        },
      },
      status
    )
  }
}
