# Page Scraper Microservice API

The service exposes a REST API for scraping individual pages, orchestrating batch jobs, and monitoring service health.

## Base URL

```
http://{host}:{port}/{API_BASE_PATH}/v1
```

Environment defaults: `host=0.0.0.0`, `port=8080`, `API_BASE_PATH=api`.

All endpoints accept and return `application/json`. No authentication is enforced by default.

---

## POST /page

Scrape a single URL and return structured content.

### Request body

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `url` | string (URL) | ✅ | — | Target page to scrape. |
| `mode` | string | ❌ | `cheerio` | Scraper engine: `cheerio` for static HTML, `playwright` for full browser rendering. |
| `taskTimeoutSecs` | number | ❌ | `DEFAULT_TASK_TIMEOUT_SECS` (30) | Per-request timeout in seconds (1–300). |
| `locale` | string | ❌ | `DEFAULT_LOCALE` (`en-US`) | Preferred locale for extraction heuristics. |
| `dateLocale` | string | ❌ | `DEFAULT_DATE_LOCALE` (`en`) | Locale used for date parsing. |
| `timezoneId` | string | ❌ | `DEFAULT_TIMEZONE_ID` (`UTC`) | Target timezone for date normalization. |
| `blockTrackers` | boolean | ❌ | `PLAYWRIGHT_BLOCK_TRACKERS` (`true`) | When Playwright is used, block analytics/tracking scripts unless explicitly `false`. |
| `blockHeavyResources` | boolean | ❌ | `PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` (`true`) | When Playwright is used, block media/fonts unless explicitly `false`. |
| `fingerprint` | object | ❌ | — | Browser fingerprint overrides (Playwright only). |

#### Fingerprint object

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `generate` | boolean | `FINGERPRINT_GENERATE` (`true`) | Toggle fingerprint generation. |
| `userAgent` | string | `auto` | Custom or auto-generated user agent. |
| `locale` | string | `source` | Browser locale; `source` randomizes from a curated list. |
| `timezoneId` | string | `source` | Browser timezone; `source` randomizes common zones. |
| `rotateOnAntiBot` | boolean | `FINGERPRINT_ROTATE_ON_ANTI_BOT` (`true`) | Rotate fingerprint when anti-bot behaviour is detected. |
| `generator` | object | — | Additional generator hints such as allowed `browsers` array. |

### Example

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

### Response 200

| Field | Type | Description |
| --- | --- | --- |
| `url` | string | Original URL. |
| `title` | string \| null | Extracted page title. |
| `description` | string \| null | Extracted description/lead. |
| `date` | string \| null | ISO-8601 publication timestamp if detected. |
| `author` | string \| null | Author name if detected. |
| `body` | string | Markdown representation of the article body. |
| `meta.lang` | string \| null | IETF language code inferred from the page. |
| `meta.readTimeMin` | number | Estimated reading time (minutes, 200 wpm heuristic). |

### Error responses

| HTTP code | Error class | Description |
| --- | --- | --- |
| 400 | `ScraperValidationException` | Invalid payload or unsupported options. |
| 422 | `ScraperContentExtractionException` | Page could not be parsed into article content. |
| 502 | `ScraperBrowserException` | Playwright/browser failure. |
| 504 | `ScraperTimeoutException` | Page load exceeded timeout. |

All domain errors follow the generic envelope described in [Error handling](#error-handling).

---

## POST /batch

Create an asynchronous batch scraping job.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | `BatchItemDto[]` | ✅ | Items to scrape. Each requires `url` (string URL) and optional `mode`. Max length is `BATCH_MAX_ITEMS` (default 100). |
| `commonSettings` | object | ❌ | Default scraper settings applied to every item (same shape as `/page` payload minus `url`). Item-level fields override these defaults. |
| `schedule` | object | ❌ | Controls pacing and concurrency. |
| `webhook` | object | ❌ | Webhook configuration triggered after completion. |

#### Schedule object

| Field | Type | Default | Constraints | Description |
| --- | --- | --- | --- | --- |
| `minDelayMs` | number | `BATCH_MIN_DELAY_MS` (1500) | 500–30000 | Minimum wait between item requests per worker. |
| `maxDelayMs` | number | `BATCH_MAX_DELAY_MS` (4000) | 1000–60000 | Maximum wait between item requests. |
| `jitter` | boolean | `true` | — | Adds ±20% random jitter to delays. |
| `concurrency` | number | `BATCH_CONCURRENCY` (1) | 1–10 | Parallel worker count. |

#### Webhook object

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string | — | Destination endpoint (required). |
| `headers` | record<string,string> | `{}` | Additional headers per request. |
| `authHeaderName` | string | — | Header key for auth token. |
| `authHeaderValue` | string | — | Header value for auth token. |
| `backoffMs` | number | `WEBHOOK_BACKOFF_MS` (1000) | Base delay for exponential backoff (100–30000). |
| `maxAttempts` | number | `WEBHOOK_MAX_ATTEMPTS` (3) | Retry limit (1–10). |

### Response 202

```json
{ "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a" }
```

The job begins processing immediately and can be polled via `/batch/{jobId}`.

### Failure modes

- `400 Bad Request` if validation fails (e.g., too many items, invalid URLs).
- `500 Internal Server Error` for unexpected failures creating the job (wrapped in `BatchJobCreationException`).

---

## GET /batch/{jobId}

Retrieve current status for a batch job.

### Response 200

| Field | Type | Description |
| --- | --- | --- |
| `jobId` | string | Job identifier. |
| `status` | string | `queued`, `running`, `succeeded`, `failed`, or `partial`. |
| `createdAt` | string | ISO timestamp when the job was enqueued. |
| `completedAt` | string \| null | ISO timestamp when processing finished (null while running). |
| `total` | number | Total items submitted. |
| `processed` | number | Items processed so far. |
| `succeeded` | number | Successful items. |
| `failed` | number | Failed items. |

### Errors

- `404 Not Found` with `BatchJobNotFoundException` when the ID is unknown or data expired (jobs are purged after `BATCH_DATA_LIFETIME_MINS`).
- Other errors are wrapped in `BatchJobStatusException` (HTTP 500).

---

## Webhook payload

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

Webhook delivery obeys exponential backoff (`backoffMs * 2^(attempt-1)`) with +10% jitter until `maxAttempts` is reached. Timeouts are governed by `WEBHOOK_TIMEOUT_MS`.

---

## GET /health

Simple readiness probe. Always returns HTTP 200 with:

```json
{ "status": "ok" }
```

The endpoint is reachable at `/{API_BASE_PATH}/v1/health` by default.

---

## Error handling

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
      "mode must be one of the following values: cheerio, playwright"
    ]
  }
}
```

---

## Operational behaviour

- Batch state is kept in-memory and purged after `BATCH_DATA_LIFETIME_MINS`. Fetching status past this window returns 404.
- Playwright scraping respects `blockTrackers` and `blockHeavyResources` flags to reduce detection and resource usage.
- Browser fingerprints rotate automatically when anti-bot signals are identified (unless disabled).
- Additional scraper-source metadata can be provided via the `CONFIG_PATH` environment variable pointing to a YAML file; it is loaded under the `sources` configuration namespace.

For implementation details and end-to-end examples see the unit and e2e tests in `test/`.