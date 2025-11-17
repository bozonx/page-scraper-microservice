# Page Scraper Microservice API Reference

Complete REST API documentation for the Page Scraper Microservice. This service provides endpoints for single-page scraping, batch job orchestration, and health monitoring.

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

**Authentication:** No authentication is enforced by default. Implement authentication at the reverse proxy or API gateway level for production deployments.

---

## Endpoints

### POST /page

Scrapes a single web page and extracts structured article content.

**Endpoint:** `POST /api/v1/page`

#### Request Body

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | string (URL) | ✅ | — | Target page to scrape. |
| `mode` | string | ❌ | `extractor` | Scraper engine: `extractor` for static HTML, `playwright` for full browser rendering. |
| `taskTimeoutSecs` | number | ❌ | `DEFAULT_TASK_TIMEOUT_SECS` (30) | Per-request timeout in seconds (1–300). This value defines the overall timeout for the task and caps the total execution time regardless of inner HTTP or browser navigation timeouts. |
| `locale` | string | ❌ | `DEFAULT_LOCALE` (`en-US`) | Preferred locale for extraction heuristics. |
| `dateLocale` | string | ❌ | `DEFAULT_DATE_LOCALE` (falls back to `DEFAULT_LOCALE`) | Locale used for date parsing. If omitted in the request, falls back to `locale`. |
| `timezoneId` | string | ❌ | `DEFAULT_TIMEZONE_ID` (`UTC`) | Target timezone for date normalization. In Playwright mode, applied at the browser context level. In extractor mode (and when extracting from HTML), sent as `X-Timezone-Id` header to guide parsing heuristics. |
| `blockTrackers` | boolean | ❌ | `DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS` (`true`) | Default behavior for blocking analytics/tracking scripts in Playwright. Per-request value overrides this default. |
| `blockHeavyResources` | boolean | ❌ | `DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` (`true`) | Default behavior for blocking media/fonts in Playwright. Per-request value overrides this default. |
| `fingerprint` | object | ❌ | — | Browser fingerprint overrides. Fully applied in Playwright (UA, viewport, etc. with rotation on anti-bot). In `extractor` mode only applicable via headers (`User-Agent`, `Accept-Language`). |

#### Fingerprint object

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `generate` | boolean | `DEFAULT_FINGERPRINT_GENERATE` (`true`) | Default toggle for fingerprint generation. Per-request value overrides. |
| `userAgent` | string | `auto` | Custom or auto-generated user agent. |
| `locale` | string | `source` | Browser locale; `source` randomizes from a curated list. |
| `timezoneId` | string | `source` | Browser timezone; `source` randomizes common zones. |
| `rotateOnAntiBot` | boolean | `DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT` (`true`) | Default: rotate fingerprint when anti-bot behaviour is detected. Per-request value overrides. |
| `generator` | object | — | Additional generator hints such as allowed `browsers` array. |

Note:

- In Playwright mode, the fingerprint is applied to the page context (e.g., user agent and viewport). Timezone and locale are set via Playwright browser context options.
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

| Field | Type | Description |
| --- | --- | --- |
| `url` | string | Original URL that was scraped. |
| `title` | string \| null | Extracted page title. |
| `description` | string \| null | Extracted meta description or article lead. |
| `date` | string \| null | ISO-8601 publication timestamp if detected. |
| `author` | string \| null | Author name if detected. |
| `body` | string | Main article content converted to Markdown format. |
| `meta.lang` | string \| null | IETF language code (e.g., `en`, `es`, `fr`) inferred from the page. |
| `meta.readTimeMin` | number | Estimated reading time in minutes (calculated at 200 words per minute). |

**Example Response:**

```json
{
  "url": "https://example.com/article",
  "title": "Sample Article Title",
  "description": "A brief description of the article content",
  "date": "2024-05-30T10:00:00.000Z",
  "author": "John Doe",
  "body": "# Article Heading\n\nArticle content in Markdown format...",
  "meta": {
    "lang": "en",
    "readTimeMin": 5
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

### POST /batch

Creates an asynchronous batch scraping job for processing multiple URLs.

**Endpoint:** `POST /api/v1/batch`

#### Request Body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | `BatchItemDto[]` | ✅ | Items to scrape. Each requires `url` (string URL) and optional `mode`. Max length is `BATCH_MAX_ITEMS` (default 100). |
| `commonSettings` | object | ❌ | Default scraper settings applied to every item (same shape as `/page` payload minus `url`). Item-level fields override these defaults. |
| `schedule` | object | ❌ | Controls pacing and concurrency. |
| `webhook` | object | ❌ | Webhook configuration triggered after completion. |

#### Schedule object

| Field | Type | Default | Constraints | Description |
| --- | --- | --- | --- | --- |
| `minDelayMs` | number | `DEFAULT_BATCH_MIN_DELAY_MS` (1500) | 500–30000 | Minimum wait between item requests per worker. |
| `maxDelayMs` | number | `DEFAULT_BATCH_MAX_DELAY_MS` (4000) | 1000–60000 | Maximum wait between item requests. |
| `jitter` | boolean | `true` | — | Adds ±20% random jitter to delays. |
| `concurrency` | number | `DEFAULT_BATCH_CONCURRENCY` (1) | 1–10 | Parallel worker count. |

#### Webhook object

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | — | Destination endpoint (required). |
| `headers` | record<string,string> | `{}` | Additional headers per request. |
| `authHeaderName` | string | — | Header key for auth token. |
| `authHeaderValue` | string | — | Header value for auth token. |
| `backoffMs` | number | `WEBHOOK_BACKOFF_MS` (1000) | Base delay for exponential backoff (100–30000). |
| `maxAttempts` | number | `WEBHOOK_MAX_ATTEMPTS` (3) | Retry limit (1–10). |

#### Success Response (202 Accepted)

```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a"
}
```

The batch job is created and begins processing immediately. Use the returned `jobId` to poll job status via `GET /batch/:jobId`.

#### Error Responses

- `400 Bad Request` if validation fails (e.g., too many items, invalid URLs).
- `500 Internal Server Error` for unexpected failures creating the job (wrapped in `BatchJobCreationException`).

---

### GET /batch/:jobId

Retrieves the current status and progress of a batch scraping job.

**Endpoint:** `GET /api/v1/batch/:jobId`

**Path Parameters:**
- `jobId` (string, required): Unique batch job identifier returned from POST /batch

#### Success Response (200 OK)

| Field | Type | Description |
| --- | --- | --- |
| `jobId` | string | Unique batch job identifier. |
| `status` | string | Current job status: `queued`, `running`, `succeeded`, `failed`, or `partial`. |
| `createdAt` | string | ISO-8601 timestamp when the job was created. |
| `completedAt` | string \| null | ISO-8601 timestamp when processing finished (null while running). |
| `total` | number | Total number of items in the batch. |
| `processed` | number | Number of items processed so far. |
| `succeeded` | number | Number of successfully processed items. |
| `failed` | number | Number of failed items. |

**Example Response:**

```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a",
  "status": "running",
  "createdAt": "2024-05-30T10:00:00.000Z",
  "completedAt": null,
  "total": 10,
  "processed": 5,
  "succeeded": 4,
  "failed": 1
}
```

#### Error Responses

- `404 Not Found` with `BatchJobNotFoundException` when the ID is unknown or data expired (jobs are purged after `BATCH_DATA_LIFETIME_MINS`).
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
      "data": { "url": "...", "title": "...", "body": "...", "meta": { "lang": "en", "readTimeMin": 6 } }
    },
    {
      "url": "https://site-b.example/article",
      "status": "failed",
      "error": {
        "code": 422,
        "message": "Failed to extract content from the page",
        "details": "Page structure is not recognizable as an article"
      }
    }
  ]
}
```

**Delivery Behavior:**
- **Retry logic:** Exponential backoff with formula `backoffMs * 2^(attempt-1)` plus 10% jitter
- **Max attempts:** Controlled by `maxAttempts` configuration (default: 3)
- **Timeout:** Each webhook request times out after `WEBHOOK_TIMEOUT_MS` milliseconds (default: 10000)
- **Trigger:** Webhook is sent when batch reaches a terminal state (`succeeded`, `failed`, or `partial`)

---


## Error Handling

All errors share a consistent JSON envelope:

```json
{
  "error": {
    "code": 422,
    "message": "Failed to extract content from the page",
    "details": "Page structure is not recognizable as an article"
  }
}
```

- `code` mirrors the HTTP status.
- `message` summarises the failure.
- `details` may be a string or array (validation errors produce an array of constraint messages).

Validation failures emitted by Nest’s `ValidationPipe` are normalized to:

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

### Batch Job Lifecycle

- **Storage:** Batch state is stored in-memory and automatically purged after `BATCH_DATA_LIFETIME_MINS` (default: 60 minutes)
- **Status polling:** Fetching status for an expired job returns `404 Not Found`
- **No batch timeout:** Individual items have their own `taskTimeoutSecs`, but there's no overall timeout for the entire batch job
- **Concurrency:** Controlled by the `schedule.concurrency` parameter (default: 1)

### Timeout Behavior

- **Task timeout:** `taskTimeoutSecs` defines the total time budget for a single scraping task
- **Scope:** This timeout caps the entire operation including HTTP requests, browser navigation, and content extraction
- **Defaults:** 30 seconds per task (configurable via `DEFAULT_TASK_TIMEOUT_SECS`)

### Anti-Bot Features

- **Resource blocking:** Playwright mode respects `blockTrackers` and `blockHeavyResources` flags to minimize detection
- **Fingerprint rotation:** Browser fingerprints rotate automatically when anti-bot signals are detected (configurable via `FINGERPRINT_ROTATE_ON_ANTI_BOT`)
- **Delays and jitter:** Batch processing uses randomized delays to mimic human behavior

### Testing

For implementation details, integration examples, and test fixtures, see the unit and e2e tests in the `test/` directory.