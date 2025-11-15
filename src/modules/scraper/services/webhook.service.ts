import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ScraperConfig } from '@config/scraper.config'
import { BatchWebhookPayloadDto, BatchWebhookDto } from '../dto/batch.dto'

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(private readonly configService: ConfigService) {}

  async sendWebhook(
    webhookConfig: BatchWebhookDto,
    payload: BatchWebhookPayloadDto
  ): Promise<void> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Page-Scraper-Webhook/1.0',
        ...webhookConfig.headers,
      }

      // Add authentication header if provided
      if (webhookConfig.authHeaderName && webhookConfig.authHeaderValue) {
        headers[webhookConfig.authHeaderName] = webhookConfig.authHeaderValue
      }

      const maxAttempts = webhookConfig.maxAttempts ?? scraperConfig.webhookMaxAttempts
      const backoffMs = webhookConfig.backoffMs ?? scraperConfig.webhookBackoffMs
      const timeoutMs = scraperConfig.webhookTimeoutMs

      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.logger.log(
            `Sending webhook attempt ${attempt}/${maxAttempts} to ${webhookConfig.url}`
          )

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            this.logger.log(
              `Webhook sent successfully to ${webhookConfig.url} on attempt ${attempt}`
            )
            return
          } else {
            const errorText = await response.text()
            lastError = new Error(`HTTP ${response.status}: ${errorText}`)
            this.logger.warn(`Webhook attempt ${attempt} failed: ${response.status} ${errorText}`)
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.logger.warn(`Webhook attempt ${attempt} failed:`, lastError.message)
        }

        // Wait before retry (except for last attempt)
        if (attempt < maxAttempts) {
          const delay = this.calculateBackoffDelay(attempt, backoffMs)
          this.logger.log(`Waiting ${delay}ms before retry...`)
          await this.sleep(delay)
        }
      }

      // All attempts failed
      throw lastError || new Error('All webhook attempts failed')
    } catch (error) {
      this.logger.error(`Failed to send webhook to ${webhookConfig.url}:`, error)
      throw error
    }
  }

  private calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
    return exponentialDelay + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
