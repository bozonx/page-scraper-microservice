import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import type { Page } from 'playwright'
import { fetch } from 'undici'
import { FetchRequestDto } from '../dto/fetch-request.dto.js'
import type { FetchErrorResponseDto, FetchResponseDto } from '../dto/fetch-response.dto.js'
import { assertUrlAllowed } from '../../../utils/ssrf.util.js'
import { FingerprintService } from './fingerprint.service.js'
import { BrowserService } from './browser.service.js'
import type { ScraperConfig } from '../../../config/scraper.config.js'
import { ConcurrencyService } from './concurrency.service.js'

interface HttpFetchOptions {
  timeoutMs: number
  maxRedirects: number
  maxResponseBytes: number
  signal?: AbortSignal
  debug: boolean
}

interface RetryDecision {
  retryable: boolean
  wasAntibot: boolean
  rotateFingerprint: boolean
  retryAfterMs?: number
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

    const scraperConfig = this.configService.get<ScraperConfig>('scraper')
    const retryMaxAttempts = Math.max(1, scraperConfig?.fetchRetryMaxAttempts ?? 3)

    if (requestDto.engine === 'http') {
      return await this.concurrencyService.run(async () => {
        const timeoutSecs = requestDto.timeoutSecs ?? 60
        const debug = requestDto.debug === true
        const totalTimeoutMs = timeoutSecs * 1000
        const deadlineMs = start + totalTimeoutMs

        const opts: HttpFetchOptions = {
          timeoutMs: totalTimeoutMs,
          maxRedirects: Math.max(0, scraperConfig?.fetchMaxRedirects ?? 7),
          maxResponseBytes: Math.max(1, scraperConfig?.fetchMaxResponseBytes ?? 10 * 1024 * 1024),
          signal,
          debug,
        }

        const allowLocalhost = process.env.NODE_ENV === 'test'

        let finalUrl: string | undefined
        let attempts = 0
        let wasAntibot = false
        let statusCode: number | undefined

        try {
          const fpBase = this.fingerprintService.generateFingerprint({
            ...requestDto.fingerprint,
            locale: requestDto.locale ?? requestDto.fingerprint?.locale,
            timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
          })

          const rotateOnAntiBot =
            requestDto.fingerprint?.rotateOnAntiBot ??
            scraperConfig?.fingerprintRotateOnAntiBot ??
            true

          for (let attempt = 0; attempt < retryMaxAttempts; attempt++) {
            if (signal?.aborted) throw new Error('Request aborted')

            const remainingMs = deadlineMs - Date.now()
            if (remainingMs <= 0) {
              throw new Error('Timeout')
            }

            const shouldRotate = attempt > 0 && wasAntibot && rotateOnAntiBot
            const fp = shouldRotate
              ? this.fingerprintService.generateFingerprint({
                  ...requestDto.fingerprint,
                  locale: requestDto.locale ?? requestDto.fingerprint?.locale,
                  timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
                })
              : fpBase

            const headers: Record<string, string> = {}
            if (fp.headers?.['User-Agent']) headers['User-Agent'] = String(fp.headers['User-Agent'])
            if (fp.headers?.['Accept-Language'])
              headers['Accept-Language'] = String(fp.headers['Accept-Language'])

            try {
              attempts = attempt + 1
              const {
                content,
                detectedContentType,
                statusCode: sc,
                responseHeaders,
                url,
              } = await this.httpFetch(
                requestDto.url,
                {
                  ...opts,
                  timeoutMs: remainingMs,
                  headers,
                  allowLocalhost,
                },
                deadlineMs
              )

              finalUrl = url
              statusCode = sc
              wasAntibot = wasAntibot || sc === 403 || sc === 429

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
              const decision = this.getRetryDecision(err)
              wasAntibot = wasAntibot || decision.wasAntibot

              if (!decision.retryable || attempt >= retryMaxAttempts - 1) {
                throw err
              }

              if (decision.retryAfterMs) {
                await this.sleep(decision.retryAfterMs, signal)
              } else {
                await this.sleep(this.computeBackoffMs(attempt), signal)
              }
              continue
            }
          }

          throw new Error('Fetch failed')
        } catch (err) {
          const durationMs = Date.now() - start
          const mapped = this.mapError(err, { debug })

          if (typeof (err as any)?.statusCode === 'number') {
            statusCode = (err as any).statusCode
          }
          if (typeof (err as any)?.finalUrl === 'string') {
            finalUrl = (err as any).finalUrl
          }

          const payload: FetchErrorResponseDto = {
            finalUrl,
            meta: {
              durationMs,
              engine: 'http',
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

    if (requestDto.engine === 'playwright') {
      return await this.concurrencyService.run(async () => {
        const timeoutSecs = requestDto.timeoutSecs ?? 60
        const debug = requestDto.debug === true
        const totalTimeoutMs = timeoutSecs * 1000
        const deadlineMs = start + totalTimeoutMs

        const allowLocalhost = process.env.NODE_ENV === 'test'

        let finalUrl: string | undefined
        let attempts = 0
        let wasAntibot = false
        let statusCode: number | undefined

        try {
          const fpBase = this.fingerprintService.generateFingerprint({
            ...requestDto.fingerprint,
            locale: requestDto.locale ?? requestDto.fingerprint?.locale,
            timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
          })

          const validatedUrl = await assertUrlAllowed(requestDto.url, { allowLocalhost })
          const navigationTimeoutMs =
            Math.max(1, scraperConfig?.playwrightNavigationTimeoutSecs ?? 60) * 1000

          const rotateOnAntiBot =
            requestDto.fingerprint?.rotateOnAntiBot ??
            scraperConfig?.fingerprintRotateOnAntiBot ??
            true

          for (let attempt = 0; attempt < retryMaxAttempts; attempt++) {
            if (signal?.aborted) throw new Error('Request aborted')

            const remainingMs = deadlineMs - Date.now()
            if (remainingMs <= 0) {
              throw new Error('Timeout')
            }

            const gotoTimeoutMs = Math.min(remainingMs, navigationTimeoutMs)

            const shouldRotate = attempt > 0 && wasAntibot && rotateOnAntiBot
            const fp = shouldRotate
              ? this.fingerprintService.generateFingerprint({
                  ...requestDto.fingerprint,
                  locale: requestDto.locale ?? requestDto.fingerprint?.locale,
                  timezoneId: requestDto.timezoneId ?? requestDto.fingerprint?.timezoneId,
                })
              : fpBase

            try {
              attempts = attempt + 1

              const result = await this.browserService.withPage(
                async (page) => {
                  const locale = requestDto.locale ?? fp.fingerprint?.navigator?.language
                  if (locale) {
                    await page.addInitScript(
                      ({ lng }) => {
                        try {
                          Object.defineProperty(navigator, 'language', {
                            get: () => lng,
                          })
                          Object.defineProperty(navigator, 'languages', {
                            get: () => [lng],
                          })
                        } catch {
                          // ignore
                        }
                      },
                      { lng: String(locale) }
                    )
                  }

                  const headers: Record<string, string> = {}
                  if (fp.headers?.['Accept-Language']) {
                    headers['Accept-Language'] = String(fp.headers['Accept-Language'])
                  } else if (locale) {
                    headers['Accept-Language'] = String(locale)
                  }
                  if (Object.keys(headers).length > 0) {
                    await page.setExtraHTTPHeaders(headers)
                  }

                  const response = await page.goto(validatedUrl.toString(), {
                    waitUntil: 'domcontentloaded',
                    timeout: gotoTimeoutMs,
                  })

                  await this.tryAcceptCookieConsent(page, signal)

                  finalUrl = page.url() || validatedUrl.toString()
                  statusCode = response?.status()
                  const responseHeaders = response?.headers() ?? undefined
                  const detectedContentType = responseHeaders?.['content-type']

                  const content = await page.content()
                  if (!content) {
                    throw new Error('Fetch resulted in empty response')
                  }

                  const maxResponseBytes = Math.max(
                    1,
                    scraperConfig?.fetchMaxResponseBytes ?? 10 * 1024 * 1024
                  )
                  if (Buffer.byteLength(content, 'utf-8') > maxResponseBytes) {
                    throw new Error('Response too large')
                  }

                  if (statusCode === 403 || statusCode === 429) {
                    const e = new Error(`HTTP status ${statusCode}`)
                    ;(e as any).statusCode = statusCode
                    throw e
                  }

                  return {
                    content,
                    detectedContentType,
                    responseHeaders,
                  }
                },
                fp,
                signal,
                {
                  timezoneId: requestDto.timezoneId,
                  locale: requestDto.locale,
                }
              )

              wasAntibot = wasAntibot || statusCode === 403 || statusCode === 429

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
              const decision = this.getRetryDecision(err)
              wasAntibot = wasAntibot || decision.wasAntibot

              if (!decision.retryable || attempt >= retryMaxAttempts - 1) {
                throw err
              }

              if (decision.retryAfterMs) {
                await this.sleep(decision.retryAfterMs, signal)
              } else {
                await this.sleep(this.computeBackoffMs(attempt), signal)
              }
              continue
            }
          }

          throw new Error('Fetch failed')
        } catch (err) {
          const durationMs = Date.now() - start
          const mapped = this.mapError(err, { debug })

          if (typeof (err as any)?.statusCode === 'number') {
            statusCode = (err as any).statusCode
          }
          if (typeof (err as any)?.finalUrl === 'string') {
            finalUrl = (err as any).finalUrl
          }

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
    },
    deadlineMs?: number
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

      const remainingMs = deadlineMs ? Math.max(0, deadlineMs - Date.now()) : opts.timeoutMs
      if (remainingMs <= 0) {
        throw new Error('Timeout')
      }

      const timeout = setTimeout(() => controller.abort(), remainingMs)

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

        this.validateContentType(detectedContentType)

        const responseHeaders: Record<string, string> = {}
        for (const [k, v] of (res.headers as any).entries()) {
          responseHeaders[k] = String(v)
        }

        const content = await this.readBodyWithLimit(res, opts.maxResponseBytes)

        if (statusCode < 200 || statusCode >= 300) {
          const e = new Error(`HTTP status ${statusCode}`)
          ;(e as any).statusCode = statusCode
          ;(e as any).finalUrl = validated.toString()
          const retryAfter = res.headers.get('retry-after')
          if (retryAfter) {
            ;(e as any).retryAfter = String(retryAfter)
          }
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
    if (!res) return ''

    const contentLengthHeader = res.headers?.get?.('content-length')
    if (typeof contentLengthHeader === 'string') {
      const parsed = Number(contentLengthHeader)
      if (Number.isFinite(parsed) && parsed > maxBytes) {
        throw new Error('Response too large')
      }
    }

    if (!res.body || typeof res.body.getReader !== 'function') {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > maxBytes) {
        throw new Error('Response too large')
      }
      return buf.toString('utf-8')
    }

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

  private validateContentType(contentType: string | undefined): void {
    if (!contentType) return

    const normalized = contentType.toLowerCase().split(';')[0].trim()

    const allowedTypes = [
      'text/',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'application/json',
      'application/ld+json',
    ]

    const isAllowed = allowedTypes.some((type) => normalized.startsWith(type))
    if (!isAllowed) {
      throw new Error(`Unsupported content type: ${normalized}`)
    }
  }

  private mapError(
    err: unknown,
    opts: { debug: boolean }
  ): { code: string; message: string; retryable: boolean; httpStatus: number } {
    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()

    if (lower.includes('invalid url') || lower.includes('unsupported url protocol')) {
      return {
        code: 'FETCH_INVALID_REQUEST',
        message: 'Invalid URL or unsupported protocol',
        retryable: false,
        httpStatus: HttpStatus.BAD_REQUEST,
      }
    }

    if (lower.includes('unsupported content type')) {
      return {
        code: 'FETCH_UNSUPPORTED_CONTENT_TYPE',
        message: msg,
        retryable: false,
        httpStatus: HttpStatus.BAD_REQUEST,
      }
    }

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
        code: 'FETCH_TOO_MANY_REDIRECTS',
        message: 'Too many redirects',
        retryable: false,
        httpStatus: HttpStatus.LOOP_DETECTED,
      }
    }

    if (lower.includes('response too large')) {
      return {
        code: 'FETCH_RESPONSE_TOO_LARGE',
        message: 'Response too large',
        retryable: false,
        httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
      }
    }

    if (lower.includes('request aborted')) {
      return {
        code: 'FETCH_ABORTED',
        message: 'Request aborted',
        retryable: false,
        httpStatus: HttpStatus.BAD_REQUEST,
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

    if (lower.includes('navigation') || lower.includes('net::') || lower.includes('page.goto')) {
      return {
        code: 'FETCH_BROWSER_ERROR',
        message: msg,
        retryable: true,
        httpStatus: HttpStatus.BAD_GATEWAY,
      }
    }

    return {
      code: 'FETCH_ERROR',
      message: msg,
      retryable: false,
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    }
  }

  private getRetryDecision(err: unknown): RetryDecision {
    const statusCode = (err as any)?.statusCode
    const retryAfterHeader = (err as any)?.retryAfter

    if (typeof statusCode === 'number') {
      const wasAntibot = statusCode === 403 || statusCode === 429
      const retryable = statusCode === 429 || statusCode >= 500
      const retryAfterMs = this.parseRetryAfterMs(retryAfterHeader)

      return {
        retryable,
        wasAntibot,
        rotateFingerprint: wasAntibot,
        ...(retryAfterMs ? { retryAfterMs } : {}),
      }
    }

    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()
    const wasAntibot =
      lower.includes('captcha') ||
      lower.includes('cloudflare') ||
      lower.includes('access denied') ||
      lower.includes('forbidden') ||
      lower.includes('rate limit')

    const retryable =
      lower.includes('timeout') || lower.includes('navigation') || lower.includes('net::') || false

    return {
      retryable,
      wasAntibot,
      rotateFingerprint: wasAntibot,
    }
  }

  private parseRetryAfterMs(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined
    const raw = value.trim()
    if (!raw) return undefined

    const asSeconds = Number(raw)
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.min(asSeconds * 1000, 60_000)
    }

    const parsed = Date.parse(raw)
    if (!Number.isFinite(parsed)) return undefined
    const ms = parsed - Date.now()
    if (ms <= 0) return undefined
    return Math.min(ms, 60_000)
  }

  private computeBackoffMs(attempt: number): number {
    const base = 250
    const max = 5000
    const exp = Math.min(max, base * 2 ** Math.max(0, attempt))
    const jitter = Math.floor(Math.random() * 200)
    return exp + jitter
  }

  private async sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return
    if (signal?.aborted) throw new Error('Request aborted')

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        cleanup()
        resolve()
      }, ms)

      const onAbort = () => {
        clearTimeout(t)
        cleanup()
        reject(new Error('Request aborted'))
      }

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort)
        }
      }

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
      }

      ;(t as any).unref?.()
    })
  }

  private async tryAcceptCookieConsent(page: Page, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return

    const selectors = [
      'button#onetrust-accept-btn-handler',
      'button[data-testid="accept-all"]',
      'button[aria-label="Accept all"]',
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      'button:has-text("Agree")',
      'button:has-text("Принять")',
      'button:has-text("Согласен")',
    ]

    for (const selector of selectors) {
      if (signal?.aborted) return
      try {
        await page.click(selector, { timeout: 300 })
        return
      } catch {
        // ignore
      }
    }
  }
}
