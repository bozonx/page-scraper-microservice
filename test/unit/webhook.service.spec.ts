import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { WebhookService } from '@/modules/scraper/services/webhook.service.js';
import { createMockLogger, createMockConfigService } from '@test/helpers/mocks.js';
import type { ScraperConfig } from '@/config/scraper.config.js';
import type { BatchWebhookDto, BatchWebhookPayloadDto } from '@/modules/scraper/dto/batch.dto.js';

describe('WebhookService (unit)', () => {
  let service: WebhookService;
  let logger: PinoLogger;
  let configService: ConfigService;

  const scraperConfig: ScraperConfig = {
    defaultMode: 'extractor',
    defaultTaskTimeoutSecs: 30,
    defaultUserAgent: 'auto',
    defaultLocale: 'en-US',
    defaultTimezoneId: 'UTC',
    defaultDateLocale: 'en',
    playwrightHeadless: true,
    playwrightNavigationTimeoutSecs: 30,
    playwrightBlockTrackers: true,
    playwrightBlockHeavyResources: true,
    fingerprintGenerate: true,
    fingerprintRotateOnAntiBot: true,
    batchMinDelayMs: 1500,
    batchMaxDelayMs: 4000,
    dataLifetimeMins: 60,
    webhookTimeoutMs: 5000,
    defaultWebhookBackoffMs: 100,
    defaultWebhookMaxAttempts: 3,
  } as ScraperConfig;

  const mockWebhookConfig: BatchWebhookDto = {
    url: 'https://example.com/webhook',
  };

  const mockPayload: BatchWebhookPayloadDto = {
    jobId: 'test-job-id',
    status: 'succeeded',
    createdAt: '2024-01-01T00:00:00.000Z',
    completedAt: '2024-01-01T00:01:00.000Z',
    total: 10,
    processed: 10,
    succeeded: 10,
    failed: 0,
    results: [],
    statusMeta: { succeeded: 10, failed: 0 },
  };

  beforeAll(async () => {
    logger = createMockLogger();
    configService = createMockConfigService({ scraper: scraperConfig });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: ConfigService, useValue: configService },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(WebhookService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('sendWebhook', () => {
    it('should send webhook successfully on first attempt', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await service.sendWebhook(mockWebhookConfig, mockPayload);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        mockWebhookConfig.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Page-Scraper-Webhook/1.0',
          }),
          body: JSON.stringify(mockPayload),
        })
      );
    });

    it('should include custom headers when provided', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const configWithHeaders: BatchWebhookDto = {
        ...mockWebhookConfig,
        headers: { 'X-Custom-Header': 'custom-value' },
      };

      await service.sendWebhook(configWithHeaders, mockPayload);

      expect(global.fetch).toHaveBeenCalledWith(
        mockWebhookConfig.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should include Authorization header when provided via headers', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const configWithAuth: BatchWebhookDto = {
        ...mockWebhookConfig,
        headers: { Authorization: 'Bearer token123' },
      };

      await service.sendWebhook(configWithAuth, mockPayload);

      expect(global.fetch).toHaveBeenCalledWith(
        mockWebhookConfig.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
        })
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      (global.fetch as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      await service.sendWebhook(mockWebhookConfig, mockPayload);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after all retry attempts fail', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle network errors with retry', async () => {
      (global.fetch as jest.Mock) = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      await service.sendWebhook(mockWebhookConfig, mockPayload);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom maxAttempts when provided', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const configWithMaxAttempts: BatchWebhookDto = {
        ...mockWebhookConfig,
        maxAttempts: 2,
      };

      await expect(service.sendWebhook(configWithMaxAttempts, mockPayload)).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom backoffMs when provided', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const configWithBackoff: BatchWebhookDto = {
        ...mockWebhookConfig,
        backoffMs: 50,
        maxAttempts: 2,
      };

      const startTime = Date.now();
      await expect(service.sendWebhook(configWithBackoff, mockPayload)).rejects.toThrow();
      const duration = Date.now() - startTime;

      // Should have at least one delay between retries (with some tolerance for timing)
      expect(duration).toBeGreaterThanOrEqual(40);
    });

    it('should log info message on successful send', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await service.sendWebhook(mockWebhookConfig, mockPayload);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Webhook sent successfully')
      );
    });

    it('should log warning on failed attempts', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log error when all attempts fail', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      await expect(service.sendWebhook(mockWebhookConfig, mockPayload)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Backoff calculation', () => {
    it('should calculate exponential backoff with jitter', async () => {
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      const configWithBackoff: BatchWebhookDto = {
        ...mockWebhookConfig,
        backoffMs: 100,
        maxAttempts: 3,
      };

      const startTime = Date.now();
      await expect(service.sendWebhook(configWithBackoff, mockPayload)).rejects.toThrow();
      const duration = Date.now() - startTime;

      // First retry: ~100ms, Second retry: ~200ms
      // Total should be at least 300ms (100 + 200)
      expect(duration).toBeGreaterThanOrEqual(300);
    });
  });
});