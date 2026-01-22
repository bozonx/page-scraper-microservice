import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { fetch } from 'undici'
import { FetchRequestDto } from '../dto/fetch-request.dto.js'
import type { FetchErrorResponseDto, FetchResponseDto } from '../dto/fetch-response.dto.js'
import { assertUrlAllowed } from '../../../utils/ssrf.util.js'
import { FingerprintService } from './fingerprint.service.js'
import { BrowserService } from './browser.service.js'
import type { ScraperConfig } from '../../../config/scraper.config.js'
import { ConcurrencyService } from './concurrency.service.js'

interface HttpFetchOptions {
  timeoutSecs: number
  maxRedirects: number
  maxResponseBytes: number
  signal?: AbortSignal
  debug: boolean
}

@Injectable()
export class FetchService {
  constructor(
    private readonly configService: ConfigService,
    private readonly fingerprintService: FingerprintService,
    private readonly concurrencyService: ConcurrencyService,
    private readonly browserService: BrowserService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(FetchService.name)
  }

  async fetch(requestDto: FetchRequestDto, signal?: AbortSignal): Promise<FetchResponseDto> {
    const start = Date.now()

    if (requestDto.engine === 'http') {
      return await this.concurrencyService.run(async () => {
        const timeoutSecs = requestDto.timeoutSecs ?? 60
        const debug = requestDto.debug === true

        const opts: HttpFetchOptions = {
          timeoutSecs,
          maxRedirects: 7,
          maxResponseBytes: 10 * 1024 * 1024,
          signal,
          debug,
        }

        const allowLocalhost =
          process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID === 'string'

        let finalUrl: string | undefined
        let attempts = 0
        let wasAntibot = false

        try {
          const fp = this.fingerprintService.generateFingerprint({
            ...requestDto.fingerprint,
            locale: requestDto.locale ?? requestDto.fingerprint?.locale,
            timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
          })

          const headers: Record<string, string> = {}
          if (fp.headers?.['User-Agent']) headers['User-Agent'] = String(fp.headers['User-Agent'])
          if (fp.headers?.['Accept-Language'])
            headers['Accept-Language'] = String(fp.headers['Accept-Language'])

          const { content, detectedContentType, statusCode, responseHeaders, url } =
            await this.httpFetch(requestDto.url, {
              ...opts,
              headers,
              allowLocalhost,
            })

          finalUrl = url
          attempts = 1
          wasAntibot = statusCode === 403 || statusCode === 429

          return {
            finalUrl,
            content,
            detectedContentType,
            meta: {
              durationMs: Date.now() - start,
              engine: 'http',
              attempts,
              wasAntibot,
              statusCode,
              ...(debug ? { responseHeaders } : {}),
            },
          }
        } catch (err) {
          const durationMs = Date.now() - start
          const mapped = this.mapError(err, { debug })

          const payload: FetchErrorResponseDto = {
            finalUrl,
            meta: {
              durationMs,
              engine: 'http',
              attempts: attempts || 1,
              wasAntibot,
            },
            error: {
              ...mapped,
              ...(debug && err instanceof Error ? { stack: err.stack } : {}),
            },
          }

          throw new HttpException(payload as any, mapped.httpStatus)
        }
      }, signal)
    }

    if (requestDto.engine === 'playwright') {
      return await this.concurrencyService.run(async () => {
        const timeoutSecs = requestDto.timeoutSecs ?? 60
        const debug = requestDto.debug === true

        const allowLocalhost =
          process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID === 'string'

        let finalUrl: string | undefined
        let attempts = 0
        let wasAntibot = false
        let statusCode: number | undefined

        try {
          const fp = this.fingerprintService.generateFingerprint({
            ...requestDto.fingerprint,
            locale: requestDto.locale ?? requestDto.fingerprint?.locale,
            timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
          })

          const validatedUrl = await assertUrlAllowed(requestDto.url, { allowLocalhost })
          const scraperConfig = this.configService.get<ScraperConfig>('scraper')
          const navigationTimeoutMs =
            Math.max(1, scraperConfig?.playwrightNavigationTimeoutSecs ?? 60) * 1000
          const gotoTimeoutMs = Math.min(timeoutSecs * 1000, navigationTimeoutMs)

          const result = await this.browserService.withPage(
            async (page) => {
              const response = await page.goto(validatedUrl.toString(), {
                waitUntil: 'domcontentloaded',
                timeout: gotoTimeoutMs,
              })

              finalUrl = page.url() || validatedUrl.toString()
              statusCode = response?.status()
              const responseHeaders = response?.headers() ?? undefined
              const detectedContentType = responseHeaders?.['content-type']

              const content = await page.content()
              if (!content) {
                throw new Error('Fetch resulted in empty response')
              }

              return {
                content,
                detectedContentType,
                responseHeaders,
              }
            },
            fp,
            signal
          )

          attempts = 1
          wasAntibot = statusCode === 403 || statusCode === 429

          return {
            finalUrl: finalUrl ?? requestDto.url,
            content: result.content,
            detectedContentType: result.detectedContentType,
            meta: {
              durationMs: Date.now() - start,
              engine: 'playwright',
              attempts,
              wasAntibot,
              statusCode,
              ...(debug ? { responseHeaders: result.responseHeaders } : {}),
            },
          }
        } catch (err) {
          const durationMs = Date.now() - start
          const mapped = this.mapError(err, { debug })

          const payload: FetchErrorResponseDto = {
            finalUrl,
            meta: {
              durationMs,
              engine: 'playwright',
              attempts: attempts || 1,
              wasAntibot,
              statusCode,
            },
            error: {
              ...mapped,
              ...(debug && err instanceof Error ? { stack: err.stack } : {}),
            },
          }

          throw new HttpException(payload as any, mapped.httpStatus)
        }
      }, signal)
    }

    const payload: FetchErrorResponseDto = {
      finalUrl: requestDto.url,
      meta: {
        durationMs: Date.now() - start,
        engine: requestDto.engine,
        attempts: 1,
        wasAntibot: false,
      },
      error: {
        code: 'FETCH_ENGINE_NOT_SUPPORTED',
        message: 'Engine is not supported',
        retryable: false,
      },
    }
    throw new HttpException(payload, HttpStatus.BAD_REQUEST)
  }

  private async httpFetch(
    inputUrl: string,
    opts: HttpFetchOptions & {
      headers: Record<string, string>
      allowLocalhost: boolean
    }
  ): Promise<{
    url: string
    statusCode: number
    detectedContentType?: string
    responseHeaders?: Record<string, string>
    content: string
  }> {
    let currentUrl = inputUrl
    let redirects = 0

    while (true) {
      const validated = await assertUrlAllowed(currentUrl, { allowLocalhost: opts.allowLocalhost })

      const controller = new AbortController()
      const onAbort = () => controller.abort()
      opts.signal?.addEventListener('abort', onAbort)

      const timeout = setTimeout(() => controller.abort(), opts.timeoutSecs * 1000)

      try {
        const res = await fetch(validated.toString(), {
          method: 'GET',
          headers: opts.headers,
          redirect: 'manual',
          signal: controller.signal,
        })

        const statusCode = res.status

        if (statusCode >= 300 && statusCode < 400 && res.headers.get('location')) {
          if (redirects >= opts.maxRedirects) {
            throw new Error('Too many redirects')
          }

          redirects += 1
          const location = String(res.headers.get('location'))
          currentUrl = new URL(location, validated).toString()

          continue
        }

        const detectedContentType = res.headers.get('content-type') ?? undefined

        const responseHeaders: Record<string, string> = {}
        for (const [k, v] of (res.headers as any).entries()) {
          responseHeaders[k] = String(v)
        }

        const content = await this.readBodyWithLimit(res, opts.maxResponseBytes)

        if (statusCode < 200 || statusCode >= 300) {
          const e = new Error(`HTTP status ${statusCode}`)
          ;(e as any).statusCode = statusCode
          ;(e as any).finalUrl = validated.toString()
          throw e
        }

        return {
          url: validated.toString(),
          statusCode,
          detectedContentType,
          responseHeaders,
          content,
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Timeout')
        }
        throw err
      } finally {
        clearTimeout(timeout)
        opts.signal?.removeEventListener('abort', onAbort)
      }
    }
  }

  private async readBodyWithLimit(res: any, maxBytes: number): Promise<string> {
    if (!res?.body || typeof res.body.getReader !== 'function') return ''

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // ignore
        }
        throw new Error('Response too large')
      }
      chunks.push(value)
    }

    const merged = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.byteLength
    }

    return new TextDecoder('utf-8').decode(merged)
  }

  private mapError(
    err: unknown,
    opts: { debug: boolean }
  ): { code: string; message: string; retryable: boolean; httpStatus: number } {
    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()

    if (lower.includes('ssrf blocked')) {
      return {
        code: 'FETCH_SSRF_BLOCKED',
        message: 'SSRF blocked',
        retryable: false,
        httpStatus: HttpStatus.BAD_REQUEST,
      }
    }

    if (lower.includes('dns') && lower.includes('failed')) {
      return {
        code: 'FETCH_DNS_BLOCKED',
        message: 'DNS lookup failed',
        retryable: false,
        httpStatus: HttpStatus.BAD_REQUEST,
      }
    }

    if (lower.includes('timeout')) {
      return {
        code: 'FETCH_TIMEOUT',
        message: 'Request timeout',
        retryable: true,
        httpStatus: HttpStatus.GATEWAY_TIMEOUT,
      }
    }

    if (lower.includes('too many redirects')) {
      return {
        code: 'FETCH_HTTP_STATUS',
        message: 'Too many redirects',
        retryable: false,
        httpStatus: HttpStatus.BAD_GATEWAY,
      }
    }

    if (lower.includes('response too large')) {
      return {
        code: 'FETCH_HTTP_STATUS',
        message: 'Response too large',
        retryable: false,
        httpStatus: HttpStatus.BAD_GATEWAY,
      }
    }

    const statusCode = (err as any)?.statusCode
    if (typeof statusCode === 'number') {
      return {
        code: 'FETCH_HTTP_STATUS',
        message: `Upstream returned HTTP ${statusCode}`,
        retryable: statusCode === 429 || statusCode >= 500,
        httpStatus: HttpStatus.BAD_GATEWAY,
      }
    }

    return {
      code: 'FETCH_BROWSER_ERROR',
      message: msg,
      retryable: true,
      httpStatus: HttpStatus.BAD_GATEWAY,
    }
  }
}
