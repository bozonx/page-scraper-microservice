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

export const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const DANGEROUS_REQUEST_HEADERS = new Set([
  'cookie',
  'authorization',
  'proxy-authorization',
  'proxy-authenticate',
])

const MAX_UPSTREAM_REQUEST_HEADERS = 50
const MAX_HEADER_NAME_LENGTH = 200
const MAX_HEADER_VALUE_LENGTH = 2000

export function sanitizeUpstreamRequestHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  if (!headers) return {}
  const out: Record<string, string> = {}

  const entries = Object.entries(headers)
  if (entries.length > MAX_UPSTREAM_REQUEST_HEADERS) {
    throw new Error('Too many headers')
  }

  for (const [k, v] of entries) {
    const key = k.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    if (DANGEROUS_REQUEST_HEADERS.has(key)) {
      throw new Error(`Forbidden header: ${k}`)
    }
    if (key === 'host') continue
    if (key === 'content-length') continue
    if (v == null) continue
    if (k.length > MAX_HEADER_NAME_LENGTH) {
      throw new Error('Header name too long')
    }
    if (v.length > MAX_HEADER_VALUE_LENGTH) {
      throw new Error('Header value too long')
    }
    out[k] = v
  }

  return out
}

export function sanitizeUpstreamResponseHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    if (key === 'set-cookie') continue
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

  private getSafeUpstreamRequestHeaders(requestDto: FileRequestDto): Record<string, string> {
    try {
      return sanitizeUpstreamRequestHeaders(requestDto.headers)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw this.httpError('FILE_INVALID_HEADERS', msg, HttpStatus.BAD_REQUEST)
    }
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

  private isRequestAborted(signal?: AbortSignal): boolean {
    return signal?.aborted === true
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

    const safeHeaders = this.getSafeUpstreamRequestHeaders(requestDto)

    while (true) {
      if (this.isRequestAborted(signal)) {
        throw this.httpError('FILE_ABORTED', 'Request aborted', HttpStatus.BAD_REQUEST)
      }
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
          headers: safeHeaders,
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
          if (this.isRequestAborted(signal)) {
            throw this.httpError('FILE_ABORTED', 'Request aborted', HttpStatus.BAD_REQUEST)
          }
          throw this.httpError('FILE_TIMEOUT', 'Request timeout', HttpStatus.GATEWAY_TIMEOUT)
        }

        if (err instanceof HttpException) {
          throw err
        }

        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('too many headers')) {
          throw this.httpError('FILE_INVALID_HEADERS', msg, HttpStatus.BAD_REQUEST)
        }
        if (msg.toLowerCase().includes('forbidden header')) {
          throw this.httpError('FILE_INVALID_HEADERS', msg, HttpStatus.BAD_REQUEST)
        }
        if (msg.toLowerCase().includes('header name too long')) {
          throw this.httpError('FILE_INVALID_HEADERS', msg, HttpStatus.BAD_REQUEST)
        }
        if (msg.toLowerCase().includes('header value too long')) {
          throw this.httpError('FILE_INVALID_HEADERS', msg, HttpStatus.BAD_REQUEST)
        }
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

  private async getPlaywrightBootstrap(
    requestDto: FileRequestDto,
    signal?: AbortSignal
  ): Promise<{ finalUrl: string; cookieHeader: string | undefined }> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const allowLocalhost = process.env.NODE_ENV === 'test'

    const validatedUrl = await assertUrlAllowed(requestDto.url, { allowLocalhost })
    const navigationTimeoutMs =
      Math.max(1, scraperConfig?.playwrightNavigationTimeoutSecs ?? 60) * 1000

    const fp = this.fingerprintService.generateFingerprint({})

    return await this.browserService.withPage(
      async (page) => {
        const safeHeaders = this.getSafeUpstreamRequestHeaders(requestDto)

        if (Object.keys(safeHeaders).length > 0) {
          await page.setExtraHTTPHeaders(safeHeaders)
        }

        const timeout = Math.min(this.getTimeoutMs(requestDto), navigationTimeoutMs)
        try {
          await page.goto(validatedUrl.toString(), { timeout, waitUntil: 'commit' })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.toLowerCase().includes('download is starting')) {
            return { finalUrl: validatedUrl.toString(), cookieHeader: undefined }
          }
          throw err
        }

        const finalUrl = page.url()
        const validatedFinalUrl = await assertUrlAllowed(finalUrl, { allowLocalhost })
        const cookies = await page.context().cookies([validatedFinalUrl.toString()])
        const cookieHeader = cookies.length
          ? cookies.map((c) => `${c.name}=${c.value}`).join('; ')
          : undefined

        return { finalUrl: validatedFinalUrl.toString(), cookieHeader }
      },
      fp,
      signal
    )
  }

  private async playwrightDownload(
    requestDto: FileRequestDto,
    signal?: AbortSignal
  ): Promise<FileProxyResult> {
    const allowLocalhost = process.env.NODE_ENV === 'test'
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const maxRedirects = Math.max(0, scraperConfig?.fileMaxRedirects ?? 7)
    const maxBytes = this.getMaxBytes(requestDto)

    const bootstrap = await this.getPlaywrightBootstrap(requestDto, signal)

    let safeHeaders = this.getSafeUpstreamRequestHeaders(requestDto)

    if (bootstrap.cookieHeader) {
      safeHeaders = {
        ...safeHeaders,
        Cookie: bootstrap.cookieHeader,
      }
    }

    return await this.httpDownloadStream(
      {
        url: bootstrap.finalUrl,
        headers: safeHeaders,
        timeoutMs: this.getTimeoutMs(requestDto),
        maxRedirects,
        maxBytes,
        allowLocalhost,
        modeUsed: 'playwright',
      },
      signal
    )
  }

  private async httpDownloadStream(
    args: {
      url: string
      headers: Record<string, string>
      timeoutMs: number
      maxRedirects: number
      maxBytes: number
      allowLocalhost: boolean
      modeUsed: 'http' | 'playwright'
    },
    signal?: AbortSignal
  ): Promise<FileProxyResult> {
    const deadlineMs = Date.now() + args.timeoutMs
    let currentUrl = args.url
    let redirects = 0

    while (true) {
      if (this.isRequestAborted(signal)) {
        throw this.httpError('FILE_ABORTED', 'Request aborted', HttpStatus.BAD_REQUEST)
      }

      const validated = await assertUrlAllowed(currentUrl, { allowLocalhost: args.allowLocalhost })

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
          headers: args.headers,
          redirect: 'manual',
          signal: controller.signal,
        })

        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          if (redirects >= args.maxRedirects) {
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
          if (Number.isFinite(parsed) && parsed > args.maxBytes) {
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
        const limiter = new ByteLimitTransform(args.maxBytes)
        const stream = upstream.pipe(limiter)

        const filteredHeaders = sanitizeUpstreamResponseHeaders(responseHeaders)

        return {
          statusCode: res.status,
          finalUrl: validated.toString(),
          headers: filteredHeaders,
          stream,
          modeUsed: args.modeUsed,
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          if (this.isRequestAborted(signal)) {
            throw this.httpError('FILE_ABORTED', 'Request aborted', HttpStatus.BAD_REQUEST)
          }
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
