# Page Scraper Microservice

Page Scraper Microservice is a NestJS/Fastify service that extracts structured article data from arbitrary web pages. It supports both lightweight HTML processing via Cheerio and full browser rendering via Playwright, adds resilient anti-bot protection, and exposes REST endpoints for single-page and batch jobs.

## Features

- **Modes:** Cheerio for fast static DOM parsing or Playwright for JavaScript-heavy sites.
- **Article extraction:** Title, description, author, publication date, language, Markdown body, and read-time estimation.
- **Batch orchestration:** Concurrent queues with configurable delays, jitter, and data retention.
- **Anti-bot fingerprints:** Rotating fingerprints and selective resource blocking to evade detection.
- **Webhook notifications:** Configurable callbacks with retry, exponential backoff, and authentication headers.
- **Structured logging:** Pino logger with per-request metadata, redaction, and environment-aware formatting.
- **Global validation & error handling:** Class-validator DTOs plus a consistent JSON error envelope.

## Architecture

```
src/
├── app.module.ts              # Root module wiring configuration, logging, and exception filter
├── common/
│   ├── exceptions/            # Typed HTTP exceptions for scraper domain
│   └── filters/               # Global Fastify-friendly exception filter
├── config/
│   ├── app.config.ts          # Core app settings (port, host, API base path, log level)
│   └── scraper.config.ts      # Scraper defaults, Playwright, batch, webhook settings
└── modules/
    ├── health/                # `/health` controller for uptime checks
    └── scraper/
        ├── dto/               # Validation DTOs for page and batch requests
        ├── scraper.controller.ts
        └── services/
            ├── scraper.service.ts        # Mode selection, Markdown conversion, metadata
            ├── batch.service.ts          # In-memory batch lifecycle and scheduling
            ├── fingerprint.service.ts    # Fingerprint generation/rotation heuristics
            ├── turndown.service.ts       # HTML → Markdown conversion
            └── webhook.service.ts        # Webhook delivery with retries
```

The service stores batch state in memory; use an external coordinator if you need horizontal scaling.

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

To override defaults, set variables before launching the service. Additional scraper source configuration can be provided via `CONFIG_PATH` pointing to a YAML file that lists target sources under the `sources` namespace.

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

### 4. Health probe

```bash
curl "http://localhost:8080/api/v1/../health"
```

Returns `{ "status": "ok" }` when the service is ready.

Refer to [`docs/api.md`](docs/api.md) for full REST contract, response schemas, and error envelopes.

## Deployment

### Local development

```bash
pnpm install
pnpm run start:dev
```

The service listens at `http://localhost:8080/api/v1` by default. Logs are pretty-printed when `NODE_ENV=development`.

### Production build

```bash
pnpm run build
NODE_ENV=production pnpm run start:prod
```

### Docker

```bash
docker-compose up -d
# or
docker build -t page-scraper-microservice ./docker
docker run --rm -p 8080:8080 page-scraper-microservice
```

Ensure `PLAYWRIGHT_*` dependencies are available in the container (Dockerfile already installs Playwright browsers).

## Testing & Quality

```bash
pnpm run lint          # ESLint
pnpm run format        # Prettier check/fix
pnpm run test:unit     # Jest unit suite
pnpm run test:e2e      # Pactum e2e suite
pnpm run test:cov      # Coverage report
```

### Test structure

- `test/unit/` covers services (fingerprint, webhook, article extractor, etc.).
- `test/e2e/` runs HTTP-level scenarios using Fastify adapter.
- Setup scripts live in `test/setup/` and are auto-loaded by Jest config.

## Operational notes

- Batch state is in memory and purged after `batchDataLifetimeMins`; persist job results externally if long-term access is required.
- Playwright mode incurs higher resource usage; size infrastructure accordingly.
- When targeting hostile sites, enable fingerprint rotation and resource blocking to reduce bans.
- Webhook payloads include full item results; secure endpoints and validate signatures on the consumer side.
- Logs redact `Authorization` and `x-api-key` headers by default.

## Contributing

1. Fork and create a topic branch from `main`.
2. Follow existing coding standards (ESLint + Prettier).
3. Add/extend unit and e2e tests for new behavior.
4. Update documentation (README, `docs/api.md`, `docs/CHANGELOG.md` if significant).
5. Submit a PR describing the change set and testing evidence.

## License

MIT License. See [`LICENSE`](LICENSE) for details.

---

### Dev quick reference

- **Start dev server:** `pnpm run start:dev`
- **Run lint:** `pnpm run lint`
- **Run tests:** `pnpm run test`
- **Format code:** `pnpm run format`

