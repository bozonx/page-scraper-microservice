# Page Scraper Microservice API Reference

Complete REST API documentation for Page Scraper Microservice. This service provides endpoints for single-page scraping, batch job orchestration, and health monitoring.

## Base URL

```
http://{host}:{port}/{API_BASE_PATH}/v1
```

**Default configuration:**
- Host: `0.0.0.0`
- Port: `8080`
- API Base Path: `api`
- Full URL: `http://localhost:8080/api/v1`

**Content Type:** All endpoints accept and return `application/json`.

**Authentication:** No authentication is enforced by default. Implement authentication at reverse proxy or API gateway level for production deployments.

**Concurrency guard:** The service enforces a global in-memory limiter sized by the `MAX_CONCURRENCY` environment variable (default `3`). All scrape operations (single page, HTML, batch items) share this pool—when at capacity, new tasks wait until existing work finishes.

---

## Endpoints

### POST /page

Scrapes a single web page and extracts structured article content.

**Endpoint:** `POST /api/v1/page`

#### Request Body

```jsonc
{
  // Target page to scrape (required)
  "url": "https://example.com/article",
  // Scraper engine: "extractor" for static HTML, "playwright" for full browser rendering. Default: extractor.
  "mode": "extractor",
  // If true returns body as provided by extractor (no Markdown conversion). Default: false.
  "rawBody": false,
  // Per-request timeout in seconds. Caps overall execution regardless of internal timeouts. Default: DEFAULT_TASK_TIMEOUT_SECS (30). No enforced maximum.
  "taskTimeoutSecs": 30,
  // Preferred locale for extraction heuristics. Default: DEFAULT_LOCALE ("en-US").
  "locale": "en-US",
  // Locale used for date parsing. Falls back to locale when omitted. Default constant: DEFAULT_DATE_LOCALE.
  "dateLocale": "en-US",
  // Target timezone for date normalization. Applied via Playwright context or X-Timezone-Id header in extractor mode. Default: DEFAULT_TIMEZONE_ID ("UTC").
  // Examples: "Europe/Moscow" (UTC+3), "Europe/London" (UTC+0/UTC+1), "America/New_York" (UTC-5/UTC-4), "Europe/Berlin" (UTC+1/UTC+2), "America/Argentina/Buenos_Aires" (UTC-3).
  "timezoneId": "UTC",
  // Default Playwright behavior blocks analytics/tracking scripts. Per-request value overrides. Default: DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS (true).
  "blockTrackers": true,
  // Default Playwright behavior blocks heavy media and fonts. Per-request value overrides. Default: DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES (true).
  "blockHeavyResources": true,
  // Browser fingerprint overrides. Fully applied in Playwright; in extractor mode only affects headers (User-Agent, Accept-Language).
  "fingerprint": {
    // Default toggle for automatic fingerprint generation. Per-request value overrides. Default: DEFAULT_FINGERPRINT_GENERATE (true).
    "generate": true,
    // Custom or auto-generated user agent string. Use "auto" to let the service decide.
    "userAgent": "auto",
    // Browser locale; "source" randomizes from a curated list.
    "locale": "source",
    // Browser timezone; "source" randomizes common zones.
    "timezoneId": "source",
    // Rotate fingerprint when anti-bot behaviour is detected. Default: DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT (true).
    "rotateOnAntiBot": true,
    // Additional generator hints such as allowed browsers list.
    "generator": {
      "browsers": ["chrome", "firefox"]
    }
  }
}
```

Note:

- In Playwright mode, fingerprint is applied to page context (e.g., user agent and viewport). Timezone and locale are set via Playwright browser context options.
- In extractor mode, fingerprint affects outbound request headers only (`User-Agent`, `Accept-Language`). Timezone is passed as `X-Timezone-Id` for downstream date parsing heuristics.

#### Example Request

```bash
curl -X POST "http://localhost:8080/api/v1/page" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://example.com/article",
        "mode": "playwright",
        "taskTimeoutSecs": 45,
        "fingerprint": {
          "rotateOnAntiBot": true,
          "generator": { "browsers": ["chrome", "firefox"] }
        }
      }'
```

#### Success Response (200 OK)

```jsonc
{
  // Original URL that was scraped.
  "url": "string",
  // Extracted page title when available.
  "title": "string | null",
  // Extracted meta description or article lead.
  "description": "string | null",
  // ISO-8601 publication timestamp if detected.
  "date": "string | null",
  // Author name when detected.
  "author": "string | null",
  // Main article content converted to Markdown format.
  "body": "string",
  // Additional metadata collected during extraction.
  "meta": {
    // IETF language code inferred from page (e.g., en, es, fr).
    "lang": "string | null",
    // Estimated reading time in minutes (200 words per minute baseline).
    "readTimeMin": "number",
    // Whether the body is returned as raw extractor output (no Markdown conversion)
    "rawBody": "boolean"
  }
}
```

#### Error Responses

| HTTP code | Error class | Description |
| --- | --- | --- |
| 400 | `ScraperValidationException` | Invalid payload or unsupported options. |
| 422 | `ScraperContentExtractionException` | Page could not be parsed into article content. |
| 502 | `ScraperBrowserException` | Playwright/browser failure. |
| 504 | `ScraperTimeoutException` | Page load exceeded timeout. |

All errors follow the consistent envelope format described in [Error Handling](#error-handling).

---

### POST /html

Retrieves raw HTML content from a web page using Playwright browser automation. Unlike `/page`, this endpoint does not extract or process content—it returns the complete rendered HTML as-is.

**Endpoint:** `POST /api/v1/html`

#### Request Body

```jsonc
{
  // Target page to retrieve HTML from (required)
  "url": "https://example.com/page",
  // Per-request timeout in seconds. Caps overall execution regardless of internal timeouts. Default: DEFAULT_TASK_TIMEOUT_SECS (30). No enforced maximum.
  "taskTimeoutSecs": 30,
  // Preferred locale for browser context. Default: DEFAULT_LOCALE ("en-US").
  "locale": "en-US",
  // Target timezone for browser context. Default: DEFAULT_TIMEZONE_ID ("UTC").
  // Examples: "Europe/Moscow" (UTC+3), "Europe/London" (UTC+0/UTC+1), "America/New_York" (UTC-5/UTC-4), "Europe/Berlin" (UTC+1/UTC+2), "America/Argentina/Buenos_Aires" (UTC-3).
  "timezoneId": "UTC",
  // Default Playwright behavior blocks analytics/tracking scripts. Per-request value overrides. Default: DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS (true).
  "blockTrackers": true,
  // Default Playwright behavior blocks heavy media and fonts. Per-request value overrides. Default: DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES (true).
  "blockHeavyResources": true,
  // Browser fingerprint overrides. Fully applied in Playwright mode.
  "fingerprint": {
    // Default toggle for automatic fingerprint generation. Per-request value overrides. Default: DEFAULT_FINGERPRINT_GENERATE (true).
    "generate": true,
    // Custom or auto-generated user agent string. Use "auto" to let the service decide.
    "userAgent": "auto",
    // Browser locale; "source" randomizes from a curated list.
    "locale": "source",
    // Browser timezone; "source" randomizes common zones.
    "timezoneId": "source",
    // Rotate fingerprint when anti-bot behaviour is detected. Default: DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT (true).
    "rotateOnAntiBot": true,
    // Additional generator hints such as allowed browsers list.
    "generator": {
      "browsers": ["chrome", "firefox"]
    }
  }
}
```

Note:
- This endpoint **always uses Playwright** for browser automation
- Fingerprint is applied to page context (e.g., user agent and viewport)
- Timezone and locale are set via Playwright browser context options
- Returns the complete rendered HTML after JavaScript execution

#### Example Request

```bash
curl -X POST "http://localhost:8080/api/v1/html" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://example.com/page",
        "taskTimeoutSecs": 45,
        "fingerprint": {
          "rotateOnAntiBot": true,
          "generator": { "browsers": ["chrome", "firefox"] }
        }
      }'
```

#### Success Response (200 OK)

```jsonc
{
  // Original URL that was retrieved.
  "url": "string",
  // Complete rendered HTML content of the page.
  "html": "string"
}
```

**Example Response:**

```jsonc
{
  // Original URL that was retrieved.
  "url": "https://example.com/page",
  // Complete rendered HTML content.
  "html": "<!DOCTYPE html><html><head><title>Example</title></head><body>...</body></html>"
}
```

#### Error Responses

| HTTP code | Error class | Description |
| --- | --- | --- |
| 400 | `ScraperValidationException` | Invalid payload or unsupported options. |
| 422 | `ScraperContentExtractionException` | Page could not be loaded or rendered. |
| 502 | `ScraperBrowserException` | Playwright/browser failure. |
| 504 | `ScraperTimeoutException` | Page load exceeded timeout. |

All errors follow the consistent envelope format described in [Error Handling](#error-handling).

---

### POST /batch

Creates an asynchronous batch scraping job for processing multiple URLs.

**Endpoint:** `POST /api/v1/batch`

#### Request Body

```jsonc
{
  // Items to scrape. Each entry requires url (string URL) and optional mode.
  "items": [
    {
      "url": "https://example.com/article-1",
      "mode": "playwright"
    },
    {
      "url": "https://example.com/article-2"
    }
  ],
  // Default scraper settings applied to every item. Same shape as /page payload minus url. Item-level fields override.
  "commonSettings": {
    "mode": "extractor",
    "taskTimeoutSecs": 60,
    // If true returns body as provided by extractor (no Markdown conversion). Default: false.
    "rawBody": false
  },
  // Controls pacing and concurrency for batch.
  "schedule": {
    // Minimum wait between item requests per worker (ms). Default: DEFAULT_BATCH_MIN_DELAY_MS (1500). Range: 500–30000.
    "minDelayMs": 1500,
    // Maximum wait between item requests (ms). Default: DEFAULT_BATCH_MAX_DELAY_MS (4000). Range: 1000–60000.
    "maxDelayMs": 4000,
    // Adds ±20% random jitter to delays. Default: true.
    "jitter": true,
    // Parallel worker count. Default: DEFAULT_BATCH_CONCURRENCY (1). Range: 1–10. Note: effective concurrency is further bounded by the global MAX_CONCURRENCY limiter.
    "concurrency": 2
  },
  // Webhook configuration triggered after completion.
  "webhook": {
    // Destination endpoint (required when webhook is provided).
    "url": "https://example.com/webhook",
    // Additional headers per request.
    "headers": {
      "X-Custom-Header": "value"
    },
    // Header key for auth token.
    "authHeaderName": "Authorization",
    // Header value for auth token.
    "authHeaderValue": "Bearer token",
    // Base delay for exponential backoff (ms). Default: DEFAULT_WEBHOOK_BACKOFF_MS (1000). Range: 100–30000.
    "backoffMs": 1000,
    // Retry limit. Default: DEFAULT_WEBHOOK_MAX_ATTEMPTS (3). Range: 1–10.
    "maxAttempts": 3
  }
}
```

#### Success Response (202 Accepted)

```jsonc
{
  // Unique job identifier for created batch.
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a"
}
```

The batch job is created and begins processing immediately. Use returned `jobId` to poll job status via `GET /batch/:jobId`.

#### Error Responses

- `400 Bad Request` if validation fails (e.g., invalid URLs).
- `500 Internal Server Error` for unexpected failures creating the job (wrapped in `BatchJobCreationException`).

---

### GET /batch/:jobId

Retrieves the current status and progress of a batch scraping job.

**Endpoint:** `GET /api/v1/batch/:jobId`

**Path Parameters:**
- `jobId` (string, required): Unique batch job identifier returned from POST /batch

#### Success Response (200 OK)

```jsonc
{
  // Unique batch job identifier.
  "jobId": "string",
  // Current job status: queued, running, succeeded, failed, or partial.
  "status": "string",
  // ISO-8601 timestamp when the job was created.
  "createdAt": "string",
  // Completion timestamp or null while running.
  "completedAt": "string | null",
  // Total number of items in the batch.
  "total": "number",
  // Number of items processed so far.
  "processed": "number",
  // Successful item count.
  "succeeded": "number",
  // Failed item count.
  "failed": "number",
  // Additional metadata about completion (only present for terminal states)
  // For partial: { completedCount: number }
  // For failed: { error: { kind: "pre_start" | "first_item", message: string, details?: string } }
  "meta": {
    "completedCount": 3,
    "error": {
      "kind": "first_item",
      "message": "Failed to extract content from page",
      "details": "Boom"
    }
  }
}
```

**Example Response:**

```jsonc
{
  // Unique batch job identifier.
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a",
  // Current job status: queued, running, succeeded, failed, or partial.
  "status": "running",
  // ISO-8601 timestamp when the job was created.
  "createdAt": "2024-05-30T10:00:00.000Z",
  // Completion timestamp or null while running.
  "completedAt": null,
  // Total number of items in the batch.
  "total": 25,
  // Number of items processed so far.
  "processed": 10,
  // Successful item count.
  "succeeded": 9,
  // Failed item count.
  "failed": 1
}
```

#### Error Responses

- `404 Not Found` with `BatchJobNotFoundException` when the ID is unknown or data expired (jobs are purged after `DATA_LIFETIME_MINS`).
- Other errors are wrapped in `BatchJobStatusException` (HTTP 500).

---

### GET /health

Health check endpoint for monitoring service availability.

**Endpoint:** `GET /api/v1/health`

#### Success Response (200 OK)

```json
{
  "status": "ok"
}
```

This endpoint always returns 200 OK when the service is operational. Use it for:
- Load balancer health checks
- Container orchestration readiness probes
- Monitoring and alerting systems

---

## Webhook Notifications

### Webhook Payload

When a webhook is configured, the service POSTs the following JSON after the job stabilizes (success, failure, or partial):

```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a",
  "status": "partial",
  "createdAt": "2024-05-30T10:00:00.000Z",
  "completedAt": "2024-05-30T10:08:12.000Z",
  "total": 5,
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "results": [
    {
      "url": "https://site-a.example/article",
      "status": "succeeded",
      "data": { "url": "...", "title": "...", "body": "...", "meta": { "lang": "en", "readTimeMin": 6, "rawBody": false } }
    },
    {
      "url": "https://site-b.example/article",
      "status": "failed",
      "error": {
        "code": 422,
        "message": "Failed to extract content from page",
        "details": "Page structure is not recognizable as an article"
      }
    }
  ],
  "meta": {
    // For partial (e.g., service shutdown): how many items were completed successfully or failed
    "completedCount": 5
  }
}
```

**Delivery Behavior:**
- **Retry logic:** Exponential backoff with formula `backoffMs * 2^(attempt-1)` plus 10% jitter
- **Max attempts:** Controlled by `maxAttempts` configuration (default: `DEFAULT_WEBHOOK_MAX_ATTEMPTS` = 3)
- **Timeout:** Each webhook request times out after `WEBHOOK_TIMEOUT_MS` milliseconds (default: 10000, global setting that cannot be overridden per request)
- **Trigger:** Webhook is sent when batch reaches a terminal state (`succeeded`, `failed`, or `partial`)
- **One-shot on shutdown:** If service shutdown cancels remaining work, the batch is finalized as `partial` and a one-shot webhook is awaited. If delivery fails, batch remains `partial` and no further action is taken
- **Default values:** `DEFAULT_WEBHOOK_BACKOFF_MS` and `DEFAULT_WEBHOOK_MAX_ATTEMPTS` are used as fallbacks when per-request values are not provided

---


## Error Handling

All errors share a consistent JSON envelope:

```json
{
  "error": {
    "code": 422,
    "message": "Failed to extract content from page",
    "details": "Page structure is not recognizable as an article"
  }
}
```

- `code` mirrors HTTP status.
- `message` summarises failure.
- `details` may be a string or array (validation errors produce an array of constraint messages).

Validation failures emitted by Nest's `ValidationPipe` are normalized to:

```json
{
  "error": {
    "code": 400,
    "message": "Validation failed",
    "details": [
      "url must be a valid URL",
      "mode must be one of the following values: extractor, playwright"
    ]
  }
}
```

---

## Operational Behavior

### Data Lifecycle & Cleanup

- **In-memory retention:** All data (single-page results and batch job state/results) is kept strictly in memory for at least `DATA_LIFETIME_MINS` minutes (default: 60)
- **Cleanup schedule:** Cleanup runs on a background interval every `CLEANUP_INTERVAL_MINS` minutes. It is not tied to incoming requests
- **Concurrency/Throttling:** Cleanup never runs concurrently and will not run more often than `CLEANUP_INTERVAL_MINS` (default: 5)
- **TTL policy:** Only data older than `DATA_LIFETIME_MINS` is deleted; younger data is skipped
- **No persistence:** No data is written to disk by the cleanup mechanism. After TTL passes and cleanup executes, the data is fully removed from memory
- **Batch status:** Polling a purged batch job returns `404 Not Found`

### Batch Job Execution

- **No batch timeout:** Individual items have their own `taskTimeoutSecs`, but there's no overall timeout for the entire batch job
- **Concurrency:** Controlled by `schedule.concurrency` parameter (default: 1)

### Shutdown Behavior

- On graceful shutdown, all running batches stop accepting results; in-flight items are disregarded
- Batch final state becomes `partial`. Metadata always includes `meta.completedCount` with the number of items completed before shutdown
- A one-shot webhook is sent and awaited before shutdown completes (subject to retry policy). If delivery fails, no further action is taken

### Failure Attribution

- For `failed` batches with zero successes, metadata includes `meta.error` with `kind` and message
- `kind = pre_start` indicates an error occurred before the first item began
- `kind = first_item` indicates the error of the first processed item

### Timeout Behavior

- **Task timeout:** `taskTimeoutSecs` defines the total time budget for a single scraping task with no enforced upper limit
- **Scope:** This timeout caps the entire operation including HTTP requests, browser navigation, and content extraction
- **Defaults:** 30 seconds per task (configurable via `DEFAULT_TASK_TIMEOUT_SECS`)

### Anti-Bot Features

- **Resource blocking:** Playwright mode respects `blockTrackers` and `blockHeavyResources` flags to minimize detection
- **Fingerprint rotation:** Browser fingerprints rotate automatically when anti-bot signals are detected (configurable via `FINGERPRINT_ROTATE_ON_ANTI_BOT`)
- **Delays and jitter:** Batch processing uses randomized delays to mimic human behavior

### Testing

For implementation details, integration examples, and test fixtures, see unit and e2e tests in the `test/` directory.