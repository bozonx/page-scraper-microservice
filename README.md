# Page Scraper Microservice

A production-ready NestJS microservice for extracting structured article data from web pages. Built on Fastify, it offers both lightweight static HTML extraction (Extractor) and full browser rendering (Playwright) with anti-bot protection, batch processing, and webhook notifications.

## Features

- **Dual scraping modes:** Extractor (@extractus/article-extractor) for fast static HTML parsing or Playwright for JavaScript-rendered content
- **Rich article extraction:** Title, description, author, publication date, language, Markdown body, and estimated reading time
- **Batch processing:** Asynchronous job orchestration with configurable concurrency, delays, and jitter
- **Anti-bot protection:** Rotating browser fingerprints and selective resource blocking to minimize detection
- **Webhook notifications:** Reliable delivery with exponential backoff, retries, and authentication support
- **Production logging:** Pino logger with request context, sensitive data redaction, and environment-aware formatting
- **Type-safe validation:** Class-validator DTOs with consistent error responses across all endpoints

## Configuration

Configuration is provided through environment variables and validated on startup. Production defaults are documented in [`env.production.example`](env.production.example).

| Variable | Description | Default |
| --- | --- | --- |
| `LISTEN_HOST` | Bind address | `0.0.0.0` |
| `LISTEN_PORT` | HTTP port | `8080` |
| `API_BASE_PATH` | Prefix for REST endpoints | `api` |
| `LOG_LEVEL` | Pino log level (`trace`…`silent`) | `warn` |
| `DEFAULT_MODE` | Scraper mode (`extractor` / `playwright`) | `extractor` |
| `DEFAULT_TASK_TIMEOUT_SECS` | Per-page timeout in seconds (>=1, no upper limit) | `30` |
| `DEFAULT_LOCALE` | Preferred locale for extraction heuristics | `en-US` |
 Examples: "Europe/Moscow" (UTC+3), "Europe/London" (UTC+0/UTC+1), "America/New_York" (UTC-5/UTC-4), "Europe/Berlin" (UTC+1/UTC+2), "America/Argentina/Buenos_Aires" (UTC-3).
| `DEFAULT_TIMEZONE_ID` | Timezone for date normalization | `UTC` |
| `DEFAULT_DATE_LOCALE` | Locale used for date parsing | falls back to `DEFAULT_LOCALE` if unset |
| `PLAYWRIGHT_HEADLESS` | Headless browser flag | `true` |
| `DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS` | Default: block analytics resources (request can override) | `true` |
| `DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` | Default: block heavy media (request can override) | `true` |
| `DEFAULT_FINGERPRINT_GENERATE` | Default: enable fingerprinting (request can override) | `true` |
| `DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT` | Default: rotate on detection signals (request can override) | `true` |
| `DEFAULT_BATCH_MIN_DELAY_MS` | Minimum delay between requests | `1500` |
| `DEFAULT_BATCH_MAX_DELAY_MS` | Maximum delay between requests | `4000` |
| `DEFAULT_BATCH_CONCURRENCY` | Parallel workers | `1` |
| `BATCH_DATA_LIFETIME_MINS` | Retention of batch results | `60` |
| `WEBHOOK_TIMEOUT_MS` | Webhook request timeout | `10000` |
| `DEFAULT_WEBHOOK_BACKOFF_MS` | Default backoff for retries (can be overridden per request) | `1000` |
| `DEFAULT_WEBHOOK_MAX_ATTEMPTS` | Default max webhook attempts (can be overridden per request) | `3` |

Set environment variables before launching the service to override defaults. 


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

## Operational Considerations

- **Batch state management:** Jobs are stored in-memory and automatically purged after `BATCH_DATA_LIFETIME_MINS`. For persistent storage or distributed deployments, integrate an external job queue (e.g., Bull, BullMQ).
- **Resource requirements:** Playwright mode requires significantly more CPU and memory than Extractor. Plan infrastructure capacity accordingly.
  - **Anti-bot strategies:** Enable defaults (`DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT=true`, `DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS=true`, `DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES=true`) and customize per request via `fingerprint.rotateOnAntiBot`, `blockTrackers`, `blockHeavyResources`.
- **Webhook security:** Webhook payloads contain full scraping results. Secure your webhook endpoints and consider implementing signature validation.
- **Logging privacy:** Sensitive headers (`Authorization`, `x-api-key`) are automatically redacted from logs.

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