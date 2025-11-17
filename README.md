# Page Scraper Microservice

A production-ready NestJS microservice for extracting structured article data from web pages. Built on Fastify, it offers both lightweight static HTML parsing (Cheerio) and full browser rendering (Playwright) with anti-bot protection, batch processing, and webhook notifications.

## Features

- **Dual scraping modes:** Cheerio for fast static HTML parsing or Playwright for JavaScript-rendered content
- **Rich article extraction:** Title, description, author, publication date, language, Markdown body, and estimated reading time
- **Batch processing:** Asynchronous job orchestration with configurable concurrency, delays, and jitter
- **Anti-bot protection:** Rotating browser fingerprints and selective resource blocking to minimize detection
- **Webhook notifications:** Reliable delivery with exponential backoff, retries, and authentication support
- **Production logging:** Pino logger with request context, sensitive data redaction, and environment-aware formatting
- **Type-safe validation:** Class-validator DTOs with consistent error responses across all endpoints

## Project Structure

```
src/
├── app.module.ts              # Root module with configuration, logging, and global filters
├── main.ts                    # Application bootstrap with Fastify adapter
├── common/
│   ├── exceptions/            # Domain-specific HTTP exceptions
│   ├── filters/               # Global exception filter for consistent error responses
│   └── interceptors/          # Request/response interceptors
├── config/
│   ├── app.config.ts          # Application settings (host, port, API path, logging)
│   └── scraper.config.ts      # Scraper configuration (modes, timeouts, batch, webhooks)
├── modules/
│   ├── health/                # Health check endpoint
│   │   └── health.controller.ts
│   └── scraper/               # Core scraping functionality
│       ├── dto/               # Request/response DTOs with validation
│       ├── scraper.controller.ts  # REST endpoints for scraping and batch jobs
│       └── services/
│           ├── scraper.service.ts     # Orchestrates scraping modes and extraction
│           ├── batch.service.ts       # Manages batch job lifecycle and scheduling
│           ├── fingerprint.service.ts # Browser fingerprint generation and rotation
│           ├── turndown.service.ts    # HTML to Markdown conversion
│           └── webhook.service.ts     # Webhook delivery with retry logic
└── utils/                     # Shared utility functions
```

**Note:** Batch state is stored in-memory and purged after the configured lifetime. For horizontal scaling or persistent storage, integrate an external job queue.

## Configuration

Configuration is provided through environment variables and validated on startup. Production defaults are documented in [`env.production.example`](env.production.example).

| Variable | Description | Default |
| --- | --- | --- |
| `LISTEN_HOST` | Bind address | `0.0.0.0` |
| `LISTEN_PORT` | HTTP port | `8080` |
| `API_BASE_PATH` | Prefix for REST endpoints | `api` |
| `LOG_LEVEL` | Pino log level (`trace`…`silent`) | `warn` |
| `DEFAULT_MODE` | Scraper mode (`cheerio` / `playwright`) | `cheerio` |
| `DEFAULT_TASK_TIMEOUT_SECS` | Per-page timeout (1-300) | `30` |
| `PLAYWRIGHT_HEADLESS` | Headless browser flag | `true` |
| `PLAYWRIGHT_BLOCK_TRACKERS` | Block analytics resources | `true` |
| `PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` | Block heavy media | `true` |
| `FINGERPRINT_GENERATE` | Enable fingerprinting | `true` |
| `FINGERPRINT_ROTATE_ON_ANTI_BOT` | Rotate on detection signals | `true` |
| `BATCH_MIN_DELAY_MS` | Minimum delay between requests | `1500` |
| `BATCH_MAX_DELAY_MS` | Maximum delay between requests | `4000` |
| `BATCH_CONCURRENCY` | Parallel workers | `1` |
| `BATCH_MAX_ITEMS` | Items per batch | `100` |
| `BATCH_DATA_LIFETIME_MINS` | Retention of batch results | `60` |
| `WEBHOOK_TIMEOUT_MS` | Webhook request timeout | `10000` |
| `WEBHOOK_BACKOFF_MS` | Base backoff for retries | `1000` |
| `WEBHOOK_MAX_ATTEMPTS` | Max webhook attempts | `3` |

Set environment variables before launching the service to override defaults. 

**Optional YAML Configuration:** Set `CONFIG_PATH` to point to a YAML file for additional scraper source metadata. The file should define sources under the `sources` namespace (see retrieved memory for details).

## Usage

### 1. Single-page scrape

```bash
curl -X POST "http://localhost:8080/api/v1/page" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://example.com/article",
        "mode": "playwright",
        "taskTimeoutSecs": 45,
        "blockTrackers": true,
        "fingerprint": { "rotateOnAntiBot": true }
      }'
```

### 2. Submit batch job

```bash
curl -X POST "http://localhost:8080/api/v1/batch" \
  -H "Content-Type: application/json" \
  -d '{
        "items": [
          { "url": "https://site1.com/a" },
          { "url": "https://site2.com/b", "mode": "playwright" }
        ],
        "commonSettings": { "taskTimeoutSecs": 45 },
        "schedule": { "concurrency": 2, "minDelayMs": 1000, "maxDelayMs": 3000 },
        "webhook": {
          "url": "https://consumer.local/webhook",
          "authHeaderName": "Authorization",
          "authHeaderValue": "Bearer <token>"
        }
      }'
```

### 3. Poll batch status

```bash
curl "http://localhost:8080/api/v1/batch/<jobId>"
```

The response lists job status (`queued`, `running`, `succeeded`, `failed`, `partial`) and progress counters.

### 4. Health check

```bash
curl "http://localhost:8080/api/v1/health"
```

Returns `{ "status": "ok" }` when the service is operational.

Refer to [`docs/api.md`](docs/api.md) for full REST contract, response schemas, and error envelopes.

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development server:**
   ```bash
   pnpm run start:dev
   ```

The service runs at `http://localhost:8080/api/v1` by default. Logs are pretty-printed in development mode.

### Production Deployment

1. **Build the application:**
   ```bash
   pnpm run build
   ```

2. **Start production server:**
   ```bash
   NODE_ENV=production pnpm run start:prod
   ```

### Docker

**Using Docker Compose:**
```bash
docker-compose up -d
```

**Using Docker directly:**
```bash
docker build -t page-scraper-microservice -f docker/Dockerfile .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  page-scraper-microservice
```

The Dockerfile includes Playwright browser dependencies for full rendering support.

## Testing

### Available Test Commands

| Command | Description |
| --- | --- |
| `pnpm run test` | Run all tests (unit + e2e) |
| `pnpm run test:unit` | Run unit tests only |
| `pnpm run test:e2e` | Run end-to-end tests |
| `pnpm run test:cov` | Generate coverage report |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run lint` | Run ESLint |
| `pnpm run format` | Format code with Prettier |

### Test Organization

```
test/
├── unit/                          # Unit tests for services and utilities
│   ├── article-extractor.service.spec.ts
│   ├── fingerprint.service.spec.ts
│   ├── health.controller.spec.ts
│   └── ...
├── e2e/                           # End-to-end API tests
│   ├── health.e2e-spec.ts        # Health endpoint tests
│   ├── scraper-mk-ru.e2e-spec.ts # Real scraping scenarios
│   └── examples/                  # Test fixtures (HTML files)
├── setup/                         # Jest configuration
│   ├── unit.setup.ts
│   └── e2e.setup.ts
└── helpers/                       # Test utilities and mocks
```

**Testing Philosophy:** E2E tests use minimal mocking—only HTTP requests are intercepted to return local HTML fixtures. All parsing, conversion, and extraction logic runs without mocks to ensure realistic validation.

## Operational Considerations

- **Batch state management:** Jobs are stored in-memory and automatically purged after `BATCH_DATA_LIFETIME_MINS`. For persistent storage or distributed deployments, integrate an external job queue (e.g., Bull, BullMQ).
- **Resource requirements:** Playwright mode requires significantly more CPU and memory than Cheerio. Plan infrastructure capacity accordingly.
- **Anti-bot strategies:** Enable fingerprint rotation (`FINGERPRINT_ROTATE_ON_ANTI_BOT=true`) and resource blocking when scraping sites with aggressive bot detection.
- **Webhook security:** Webhook payloads contain full scraping results. Secure your webhook endpoints and consider implementing signature validation.
- **Logging privacy:** Sensitive headers (`Authorization`, `x-api-key`) are automatically redacted from logs.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a feature branch from `main`
2. **Follow code standards:** Use ESLint and Prettier (run `pnpm run lint` and `pnpm run format`)
3. **Write tests:** Add or update unit and e2e tests for new features or bug fixes
4. **Update documentation:** Keep README, API docs, and CHANGELOG current
5. **Submit a pull request** with a clear description of changes and test results

## License

MIT License. See [`LICENSE`](LICENSE) for full details.

---

## Development Reference

| Task | Command |
| --- | --- |
| Start dev server | `pnpm run start:dev` |
| Build for production | `pnpm run build` |
| Run all tests | `pnpm run test` |
| Run unit tests | `pnpm run test:unit` |
| Run e2e tests | `pnpm run test:e2e` |
| Lint code | `pnpm run lint` |
| Format code | `pnpm run format` |
| Generate coverage | `pnpm run test:cov` |

