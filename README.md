# Page Scraper Microservice

A production-ready NestJS microservice designed to extract structured article data from web pages. It supports both lightweight static HTML extraction and full browser rendering via Playwright, complete with anti-bot protection, batch processing, and webhook notifications.

## Features

- **Dual Scraping Modes:** 
  - **Extractor:** Fast static HTML parsing using `@extractus/article-extractor`.
  - **Playwright:** Full Chrome/Firefox rendering for JavaScript-heavy sites with configurable navigation timeouts.
- **Rich Data Extraction:** Captures title, description, author, date, language, main image, favicon, content type, source, outgoing links, time-to-read estimates, and converts body to Markdown (or returns raw HTML).
- **Batch Processing:** Orchestrate multiple URL scrapes asynchronously with configurable delays, random jitter, and per-item settings override.
- **Advanced Anti-Bot Protection:** 
  - Rotating browser fingerprints (User-Agent, viewport, locale, timezone) with customizable generator settings.
  - Selective resource blocking (analytics, trackers, images, videos, fonts).
  - Automatic fingerprint rotation on bot detection.
- **Reliable Webhooks:** Notification system with configurable timeouts, exponential backoff, and retry attempts upon batch completion.
- **Production Ready:** Built on Fastify with structured logging (Pino), strict validation (class-validator DTOs), global concurrency limits, and automatic data cleanup.


---

## Architecture Overview

### Technology Stack
- **Framework:** NestJS with Fastify adapter for high performance
- **Scraping Engines:**
  - `@extractus/article-extractor` for static content extraction
  - Playwright (Chromium/Firefox) for dynamic content rendering
- **Validation:** class-validator and class-transformer for strict DTO validation
- **Logging:** Pino for structured, high-performance logging
- **Fingerprinting:** fingerprint-generator and fingerprint-injector for browser simulation

### Project Structure
```
src/
├── config/           # Configuration modules (app, scraper)
├── modules/
│   ├── scraper/      # Core scraping logic, DTOs, controllers
│   ├── batch/        # Batch job management and scheduling
│   └── webhook/      # Webhook delivery with retry logic
├── common/           # Shared utilities, guards, filters
└── main.ts           # Application entry point
```

### Key Components
- **ScraperService:** Orchestrates extraction and Playwright modes
- **BatchService:** Manages batch jobs, scheduling, and concurrency
- **WebhookService:** Handles reliable webhook delivery with retries
- **ConcurrencyLimiter:** Global in-memory queue for task throttling
- **FingerprintService:** Generates and manages browser fingerprints

---

## Quick Start

### Local Development

1.  **Install dependencies:**
    ```bash
    pnpm install
    pnpm dlx playwright install chromium firefox
    ```

2.  **Start development server:**
    ```bash
    pnpm run start:dev
    ```
    The API will be available at `http://localhost:8080/api/v1`.

### Production Build

1.  **Build:**
    ```bash
    pnpm run build
    ```
2.  **Run:**
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
  page-scraper-microservice
```

---

## Configuration

Configure the service using environment variables.

### Basic Application Settings

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Node.js environment mode (`development`, `production`, `test`) | `production` |
| `LISTEN_HOST` | Server bind address | `0.0.0.0` |
| `LISTEN_PORT` | Server port (1-65535) | `8080` |
| `API_BASE_PATH` | Base path for API endpoints (e.g., `api` → `/api/v1/...`) | `api` |
| `LOG_LEVEL` | Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`) | `warn` |
| `TZ` | Application timezone (affects logs and date handling) | `UTC` |

### Concurrency & Performance

| Variable | Description | Default |
| --- | --- | --- |
| `MAX_CONCURRENCY` | Maximum concurrent scraping tasks across the entire service | `3` |

### Scraper Settings

| Variable | Description | Default |
| --- | --- | --- |
| `DEFAULT_MODE` | Default scraper mode (`extractor` or `playwright`) | `extractor` |
| `DEFAULT_TASK_TIMEOUT_SECS` | Default timeout per page scrape in seconds (≥1) | `60` |


### Fingerprint Settings

| Variable | Description | Default |
| --- | --- | --- |
| `DEFAULT_FINGERPRINT_GENERATE` | Enable browser fingerprint generation to avoid detection | `true` |
| `DEFAULT_FINGERPRINT_USER_AGENT` | Default user agent string (`auto` for automatic selection) | `auto` |
| `DEFAULT_FINGERPRINT_LOCALE` | Default locale for browser fingerprint (e.g., `en-US`, `ru-RU`) | `en-US` |
| `DEFAULT_FINGERPRINT_TIMEZONE_ID` | Default timezone ID for browser (e.g., `UTC`, `Europe/Moscow`) | `UTC` |
| `DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT` | Rotate fingerprint when anti-bot protection is detected | `true` |

#### Available Fingerprint Options

When using the `fingerprint` parameter in API requests, you can specify the following options:

**Browsers** (`browsers` array):
- `chrome` - Google Chrome browser
- `firefox` - Mozilla Firefox browser

**Operating Systems** (`operatingSystems` array):
- `windows` - Microsoft Windows
- `macos` - Apple macOS
- `linux` - Linux distributions
- `android` - Android mobile OS
- `ios` - Apple iOS

**Devices** (`devices` array):
- `desktop` - Desktop computers
- `mobile` - Mobile devices (phones and tablets)

**Locales** (`locales` array):
- Any valid locale string (e.g., `en-US`, `ru-RU`, `de-DE`, `fr-FR`, `es-ES`, `ja-JP`, `zh-CN`)


### Playwright Settings

| Variable | Description | Default |
| --- | --- | --- |
| `PLAYWRIGHT_HEADLESS` | Run browser in headless mode (no UI) | `true` |
| `PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS` | Navigation timeout for browser operations in seconds (≥1) | `30` |
| `DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS` | Block tracking scripts and analytics for faster loading | `true` |
| `DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` | Block images, videos, and fonts for faster scraping | `true` |

### Batch Processing Settings

| Variable | Description | Default |
| --- | --- | --- |
| `DEFAULT_BATCH_MIN_DELAY_MS` | Minimum delay between requests in milliseconds (500-3600000) | `1500` |
| `DEFAULT_BATCH_MAX_DELAY_MS` | Maximum delay between requests in milliseconds (1000-3600000) | `4000` |
| `DATA_LIFETIME_MINS` | Retention time for in-memory batch results in minutes (1-44640) | `60` |
| `CLEANUP_INTERVAL_MINS` | Minimum interval between cleanup runs in minutes (1-10080) | `10` |

### Webhook Settings

| Variable | Description | Default |
| --- | --- | --- |
| `DEFAULT_WEBHOOK_TIMEOUT_SECS` | Default timeout for webhook HTTP requests in seconds (1-600) | `30` |
| `DEFAULT_WEBHOOK_BACKOFF_MS` | Default backoff delay between retry attempts in milliseconds (100-600000) | `1000` |
| `DEFAULT_WEBHOOK_MAX_ATTEMPTS` | Default maximum retry attempts for failed webhooks (1-100) | `3` |

*See `.env.production.example` and `.env.development.example` for complete configuration examples.*

---

## API Reference

**Base URL:** `http://localhost:8080/api/v1`

### 1. Scrape a Page (`POST /page`)

Extracts structured data (title, content, metadata) from a single URL.

**Request:**
```jsonc
POST /api/v1/page
{
  "url": "https://example.com/article",
  "mode": "playwright",          // "extractor" (default) or "playwright"
  "rawBody": false,              // If true, returns HTML body instead of Markdown
  "taskTimeoutSecs": 60,         // Override default timeout (≥1)
  "blockTrackers": true,         // Block analytics (Playwright only)
  "blockHeavyResources": false,  // Block images, videos, fonts (Playwright only)
  "fingerprint": {               // Browser fingerprint settings (Playwright only)
    "generate": true,            // Enable fingerprint generation
    "userAgent": "auto",         // Custom user agent or "auto"
    "locale": "en-US",           // Browser locale (e.g., "en-US", "ru-RU")
    "timezoneId": "UTC",         // Timezone ID (e.g., "UTC", "Europe/Moscow")
    "rotateOnAntiBot": true,     // Rotate fingerprint on bot detection
    "browsers": ["chrome", "firefox"], // Browser types to simulate
    "operatingSystems": ["windows", "macos", "linux"], // OS types to simulate
    "devices": ["desktop", "mobile"], // Device types to simulate
    "locales": ["en-US"]         // Locales to simulate
  }
}
```

**Response (200 OK):**
```jsonc
{
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "An interesting read...",
  "author": "John Doe",
  "date": "2023-10-01T12:00:00.000Z",
  "image": "https://example.com/img.jpg",
  "favicon": "https://example.com/favicon.ico",
  "type": "article",             // Content type (e.g., "article", "video")
  "source": "Example News",      // Publisher/source name
  "body": "# Example Article\n\nContent here...", // Markdown format
  "links": [                     // Outgoing links from the article
    { "href": "https://related.com", "text": "Related Article" }
  ],
  "ttr": 300,                    // Time-to-read in seconds
  "meta": {
    "lang": "en",
    "readTimeMin": 5,            // Reading time in minutes (at 200 wpm)
    "rawBody": false             // Whether body is raw HTML
  }
}
```

### 2. Get Raw HTML (`POST /html`)

Returns the fully rendered HTML of a page using Playwright. Useful for debug or custom parsing.

**Request:**
```jsonc
POST /api/v1/html
{
  "url": "https://example.com/dynamic-page",
  "taskTimeoutSecs": 60,         // Override default timeout (≥1)
  "blockTrackers": true,         // Block analytics scripts
  "blockHeavyResources": false,  // Block images, videos, fonts
  "fingerprint": {               // Browser fingerprint settings (same as /page)
    "generate": true,
    "userAgent": "auto",
    "locale": "en-US",
    "timezoneId": "UTC",
    "rotateOnAntiBot": true,
    "browsers": ["chrome"]
  }
}
```

**Response (200 OK):**
```jsonc
{
  "url": "https://example.com/dynamic-page",
  "html": "<!DOCTYPE html><html>...</html>"
}
```

### 3. Create Batch Job (`POST /batch`)

Queue multiple URLs for processing. Returns a Job ID immediately.

**Request:**
```jsonc
POST /api/v1/batch
{
  "items": [
    { "url": "https://site1.com/a" },
    { "url": "https://site2.com/b", "mode": "playwright", "rawBody": true }
  ],
  "commonSettings": {            // Settings applied to all items
    "mode": "extractor",         // Default mode for all items
    "taskTimeoutSecs": 60,       // Default timeout (≥1)
    "rawBody": false,            // Return raw HTML instead of Markdown
    "blockTrackers": true,       // Block analytics (Playwright only)
    "blockHeavyResources": false,// Block images, videos, fonts (Playwright only)
    "fingerprint": {             // Default fingerprint for all items
      "generate": true,
      "userAgent": "auto",
      "locale": "en-US",
      "timezoneId": "UTC",
      "rotateOnAntiBot": true,
      "browsers": ["chrome", "firefox"],
    "operatingSystems": ["windows", "macos"],
    "devices": ["desktop"]
    }
  },
  "schedule": {                  // Batch processing timing
    "minDelayMs": 1000,          // Min delay between requests (500-3600000)
    "maxDelayMs": 3000,          // Max delay between requests (1000-3600000)
    "jitter": true               // Add random jitter to delays
  },
  "webhook": {                   // Completion notification
    "url": "https://your-api.com/webhook",
    "headers": { "Authorization": "Bearer secret" },
    "timeoutSecs": 30,           // Webhook request timeout (1-600)
    "backoffMs": 1000,           // Retry backoff delay (100-600000)
    "maxAttempts": 3             // Max retry attempts (1-100)
  }
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a"
}
```

### 4. Check Batch Status (`GET /batch/:jobId`)

Poll the status of a batch job.

**Response (200 OK):**
```jsonc
{
  "jobId": "0f1c5d8e...",
  "status": "partial",           // queued, running, succeeded, failed, partial
  "createdAt": "2023-10-01T12:00:00.000Z",  // Job creation timestamp
  "completedAt": "2023-10-01T12:05:00.000Z", // Job completion timestamp (if completed)
  "total": 2,
  "processed": 2,
  "succeeded": 1,
  "failed": 1,
  "statusMeta": {                // Status metadata
    "succeeded": 1,
    "failed": 1,
    "message": "Task 1 error: timeout" // First error message if any
  },
  "results": [
    {
      "url": "https://site1.com/a",
      "status": "succeeded",
      "data": { ... }            // Same structure as /page response
    },
    {
      "url": "https://site2.com/b",
      "status": "failed",
      "error": {
        "code": 408,
        "message": "Request timeout",
        "details": "Page load exceeded timeout"
      }
    }
  ]
}
```

### 5. Health Check (`GET /health`)

**Response:** `{"status": "ok"}`

---

## Webhooks

When a batch job completes (or fails), the service sends a POST request to your configured webhook URL.

**Payload Structure:**
```jsonc
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a",
  "status": "partial",           // succeeded, failed, or partial
  "createdAt": "2023-10-01T12:00:00.000Z",
  "completedAt": "2023-10-01T12:05:00.000Z",
  "total": 2,
  "processed": 2,
  "succeeded": 1,
  "failed": 1,
  "statusMeta": {
    "succeeded": 1,
    "failed": 1,
    "message": "Task 1 error: timeout"
  },
  "results": [
    {
      "url": "https://site1.com/a",
      "status": "succeeded",
      "data": { ... }            // Full scraping result
    },
    {
      "url": "https://site2.com/b",
      "status": "failed",
      "error": {
        "code": 408,
        "message": "Request timeout",
        "details": "Page load exceeded timeout"
      }
    }
  ]
}
```

**Behavior:**
- **Retries:** Exponential backoff with configurable attempts (default 3).
- **Timeout:** Configurable per webhook (default 30 seconds).
- **Trigger:** Sent when job status becomes `succeeded`, `failed`, or `partial`.

---

## Operational Details

### Concurrency Management
- **Global Limiter:** Uses an in-memory concurrency limiter (`MAX_CONCURRENCY`). All scraping requests (single page or batch) share this limit to prevent resource exhaustion.
- **Queue System:** When the limit is reached, new tasks wait in a queue until a slot becomes available.

### Data Lifecycle
- **In-Memory Storage:** Batch job results are stored in memory for quick access.
- **Automatic Cleanup:** Results are automatically purged after `DATA_LIFETIME_MINS` (default 60 minutes).
- **Cleanup Interval:** Cleanup runs every `CLEANUP_INTERVAL_MINS` (default 10 minutes).
- **Stateless Service:** If the service restarts, all job history is lost. This is by design for simplicity.

### Anti-Bot Protection
- **Browser Fingerprints:** 
  - Generates realistic browser profiles (User-Agent, screen size, locale, timezone) to mimic real devices.
  - Supports multiple browsers (Chrome, Firefox), operating systems, and device types.
  - Customizable via `fingerprint` settings per request (browsers, operatingSystems, devices, locales).
- **Resource Blocking:** 
  - **Trackers:** Blocks analytics scripts (Google Analytics, Facebook Pixel, etc.) to speed up loading and reduce detection.
  - **Heavy Resources:** Optionally blocks images, videos, and fonts to minimize bandwidth and improve performance.
- **Adaptive Behavior:**
  - **Fingerprint Rotation:** When `rotateOnAntiBot` is enabled, automatically generates a new fingerprint if bot detection is suspected.
  - **Random Delays:** Batch jobs use configurable random delays (`minDelayMs` to `maxDelayMs`) with optional jitter to avoid rate limiting.

### Error Handling
- **Timeouts:** Each scraping task has a configurable timeout (`taskTimeoutSecs`). Tasks exceeding this limit are terminated.
- **Graceful Failures:** Failed tasks in batch jobs don't stop the entire job. The job continues and reports individual failures.
- **Detailed Errors:** Error responses include HTTP status codes, messages, and optional details for debugging.


---

## Usage Examples

### Example 1: Simple Article Extraction
```bash
curl -X POST http://localhost:8080/api/v1/page \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

### Example 2: JavaScript-Heavy Site with Custom Fingerprint
```bash
curl -X POST http://localhost:8080/api/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://dynamic-site.com/page",
    "mode": "playwright",
    "blockTrackers": true,
    "blockHeavyResources": true,
    "fingerprint": {
      "locale": "ru-RU",
      "timezoneId": "Europe/Moscow",
      "browsers": ["firefox"],
      "operatingSystems": ["linux"]
    }
  }'
```

### Example 3: Batch Scraping with Webhook
```bash
curl -X POST http://localhost:8080/api/v1/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"url": "https://site1.com/article1"},
      {"url": "https://site2.com/article2"},
      {"url": "https://site3.com/article3"}
    ],
    "commonSettings": {
      "mode": "extractor",
      "taskTimeoutSecs": 60
    },
    "schedule": {
      "minDelayMs": 2000,
      "maxDelayMs": 5000,
      "jitter": true
    },
    "webhook": {
      "url": "https://your-api.com/webhook",
      "headers": {"Authorization": "Bearer YOUR_TOKEN"},
      "timeoutSecs": 30,
      "maxAttempts": 5
    }
  }'
```

### Example 4: Get Raw HTML for Custom Processing
```bash
curl -X POST http://localhost:8080/api/v1/html \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://spa-app.com",
    "taskTimeoutSecs": 60,
    "blockTrackers": true
  }'
```

### Example 5: Mobile Device Simulation
```bash
curl -X POST http://localhost:8080/api/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mobile-site.com",
    "mode": "playwright",
    "fingerprint": {
      "browsers": ["chrome"],
      "operatingSystems": ["android"],
      "devices": ["mobile"],
      "locale": "en-US"
    }
  }'
```

---


## Limitations and Best Practices

### Limitations
- **Stateless Design:** All batch job data is stored in memory. Service restarts will lose all job history.
- **No Persistence:** Results are automatically deleted after `DATA_LIFETIME_MINS`. Download results before they expire.
- **Concurrency Limit:** The global `MAX_CONCURRENCY` limit applies to all requests. High concurrency may require scaling.
- **Memory Usage:** Large batch jobs with many results can consume significant memory. Monitor memory usage in production.

### Best Practices
- **Use Extractor Mode First:** Start with `extractor` mode for faster performance. Switch to `playwright` only for JavaScript-heavy sites.
- **Set Appropriate Timeouts:** Adjust `taskTimeoutSecs` based on target site complexity. Longer timeouts for slow sites.
- **Configure Delays:** Use `minDelayMs` and `maxDelayMs` in batch jobs to avoid overwhelming target servers and triggering rate limits.
- **Enable Jitter:** Set `schedule.jitter: true` in batch jobs to randomize delays and appear more human-like.
- **Block Resources:** Enable `blockTrackers` and `blockHeavyResources` for faster scraping when images/videos aren't needed.
- **Monitor Webhooks:** Implement proper webhook endpoint with idempotency handling. The same webhook may be delivered multiple times on retries.
- **Poll Batch Status:** For critical jobs, poll `GET /batch/:jobId` periodically as a backup to webhooks.
- **Adjust Concurrency:** Increase `MAX_CONCURRENCY` for higher throughput, but monitor CPU and memory usage.

---

## Testing

The project includes unit and end-to-end tests.

```bash
# Run all tests
pnpm run test

# Run unit tests only
pnpm run test:unit
```

## License

MIT License.