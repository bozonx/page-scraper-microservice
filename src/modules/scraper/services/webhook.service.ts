import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { ScraperConfig } from '../../../config/scraper.config.js'
import { BatchWebhookPayloadDto, BatchWebhookDto } from '../dto/batch.dto.js'

/**
 * Service for sending webhook notifications on batch job completion
 * Implements retry logic with exponential backoff and jitter
 */
@Injectable()
export class WebhookService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(WebhookService.name)
  }

  /**
   * Sends webhook notification with retry logic
   * @param webhookConfig Webhook configuration including URL and authentication
   * @param payload Payload to send in webhook request
   */
  async sendWebhook(
    webhookConfig: BatchWebhookDto,
    payload: BatchWebhookPayloadDto
  ): Promise<void> {
    const scraperConfig = this.configService.get<ScraperConfig>('scraper')!

    try {
      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Page-Scraper-Webhook/1.0',
        ...webhookConfig.headers,
      }

      // Get retry configuration - use per-request values or fall back to defaults
      const maxAttempts = webhookConfig.maxAttempts ?? scraperConfig.defaultWebhookMaxAttempts
      const backoffMs = webhookConfig.backoffMs ?? scraperConfig.defaultWebhookBackoffMs
      const timeoutMs = scraperConfig.webhookTimeoutMs

      let lastError: Error | null = null

      // Retry loop with exponential backoff
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          this.logger.info(
            `Sending webhook attempt ${attempt}/${maxAttempts} to ${webhookConfig.url}`
          )

          // Set up timeout controller
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          // Send webhook request
          const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          // Check if request was successful
          if (response.ok) {
            this.logger.info(
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
          this.logger.info(`Waiting ${delay}ms before retry...`)
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

  /**
   * Calculates exponential backoff delay with jitter
   * @param attempt Current attempt number (1-based)
   * @param baseDelayMs Base delay in milliseconds
   * @returns Calculated delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
    return exponentialDelay + jitter
  }

  /**
   * Simple sleep utility for delaying execution
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after specified delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
