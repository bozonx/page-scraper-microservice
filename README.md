# Page Scraper Microservice

A production-ready NestJS microservice designed to extract structured article data from web pages. It supports both lightweight static HTML extraction and full browser rendering via Playwright, complete with anti-bot protection.

## Features

- **Dual Scraping Modes:** 
  - **Extractor:** Fast static HTML parsing using `@extractus/article-extractor`.
  - **Playwright:** Full Chrome rendering for JavaScript-heavy sites with configurable navigation timeouts.
- **Rich Data Extraction:** Captures title, description, author, date, language, main image, favicon, content type, source, outgoing links, time-to-read estimates, and converts body to Markdown (or returns raw HTML).
- **Advanced Anti-Bot Protection:** 
  - Rotating browser fingerprints (User-Agent, viewport, locale, timezone) with customizable generator settings.
  - Selective resource blocking (analytics, trackers, images, videos, fonts).
  - Automatic fingerprint rotation on bot detection.
- **Production Ready:** Built on Fastify with structured logging (Pino), strict validation (class-validator DTOs), global concurrency limits, and automatic data cleanup.


---

## Architecture Overview

### Technology Stack
- **Framework:** NestJS with Fastify adapter for high performance
- **Scraping Engines:**
  - `@extractus/article-extractor` for static content extraction
  - Playwright (Chromium) for dynamic content rendering
- **Validation:** class-validator and class-transformer for strict DTO validation
- **Logging:** Pino for structured, high-performance logging
- **Fingerprinting:** fingerprint-generator and fingerprint-injector for browser simulation

### Project Structure
```
src/
├── config/           # Configuration modules (app, scraper)
├── modules/
│   ├── scraper/      # Core scraping logic, DTOs, controller
│   └── health/       # Health check endpoint
├── common/           # Shared utilities, guards, filters
└── main.ts           # Application entry point
```

### Key Components
- **ScraperService:** Orchestrates extraction and Playwright modes
- **ConcurrencyService:** Global in-memory queue for task throttling
- **FingerprintService:** Generates and manages browser fingerprints

---

## Quick Start

### Local Development

1.  **Install dependencies:**
    ```bash
    pnpm install
    pnpm dlx playwright install chromium
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
 docker compose -f docker/docker-compose.yml up -d
 ```
 
 **Using Docker directly:**
 ```bash
 pnpm run build
 docker build -t page-scraper-microservice -f docker/Dockerfile .
 docker run --rm -p 8080:8080 \
   -e NODE_ENV=production \
   page-scraper-microservice
 ```

---

## Test UI

A vanilla JavaScript web interface is available for testing the microservice functionality without writing code.

 **Access the UI:**
 - Start the service (development or production)
 - Open your browser to `http://localhost:8080/` (or `http://localhost:8080/{BASE_PATH}/` if `BASE_PATH` is set)
 
 **Features:**
 - **Single Page Tab:** Test the `/page` endpoint including fingerprint options (`userAgent`, `operatingSystems`, `devices`)
 - **Fetch Content Tab:** Test the `/fetch` endpoint including fingerprint options and optional `locale`/`timezoneId` overrides
 
 The UI provides forms for all endpoint parameters including fingerprint settings and timeouts. Responses are displayed in a formatted JSON viewer.

---

## Configuration

Configure the service using environment variables.

### Basic Application Settings

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Node.js environment mode (`development`, `production`, `test`) | `production` |
| `LISTEN_HOST` | Server bind address | `0.0.0.0` |
| `LISTEN_PORT` | Server port (1-65535) | `8080` |
| `BASE_PATH` | Base path for application. API will be at `{BASE_PATH}/api/v1/...` | `(empty)` |
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

- `chrome` - Google Chrome browser (default)

**Operating Systems** (`operatingSystems` array):
- `windows` - Microsoft Windows
- `macos` - Apple macOS
- `linux` - Linux distributions
- `android` - Android mobile OS
- `ios` - Apple iOS

**Devices** (`devices` array):
- `desktop` - Desktop computers
- `mobile` - Mobile devices (phones and tablets)


### Playwright Settings

| Variable | Description | Default |
| --- | --- | --- |
| `PLAYWRIGHT_HEADLESS` | Run browser in headless mode (no UI) | `true` |
| `PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS` | Navigation timeout for browser operations in seconds (≥1) | `30` |
| `PLAYWRIGHT_EXTRA_ARGS` | Extra Chromium args for Playwright. Format: JSON array (recommended) or space-separated string | `[]` |
| `DEFAULT_PLAYWRIGHT_BLOCK_TRACKERS` | Block tracking scripts and analytics for faster loading | `true` |
| `DEFAULT_PLAYWRIGHT_BLOCK_HEAVY_RESOURCES` | Block images, videos, and fonts for faster scraping | `true` |

### Fetch (`/fetch`) Settings

| Variable | Description | Default |
| --- | --- | --- |
| `FETCH_RETRY_MAX_ATTEMPTS` | Maximum number of attempts for `/fetch` retries (both engines) | `3` |
| `FETCH_MAX_REDIRECTS` | Maximum number of redirects for `/fetch` with `engine=http` | `7` |
| `FETCH_MAX_RESPONSE_BYTES` | Maximum response size in bytes for `/fetch` with `engine=http` | `10485760` |

### Data Cleanup Settings

| Variable | Description | Default |
| --- | --- | --- |
| `DATA_LIFETIME_MINS` | Retention time for in-memory page data in minutes (1-44640) | `60` |
| `CLEANUP_INTERVAL_MINS` | Minimum interval between cleanup runs in minutes (1-10080) | `10` |

*See `.env.production.example` and `.env.development.example` for complete configuration examples.*

---

## API Reference

**Base URL:** `http://localhost:8080/api/v1`
 
 If `BASE_PATH` is set, all routes (including the API and the Test UI) are prefixed with it. Example: `BASE_PATH=app` => API base URL is `http://localhost:8080/app/api/v1`.

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
  "fingerprint": {               // Browser fingerprint settings (Playwright only)
    "generate": true,            // Enable fingerprint generation
    "userAgent": "auto",         // Custom user agent or "auto"
    "locale": "en-US",           // Browser locale (e.g., "en-US", "ru-RU")
    "timezoneId": "UTC",         // Timezone ID (e.g., "UTC", "Europe/Moscow")
    "rotateOnAntiBot": true,     // Rotate fingerprint on bot detection
    "blockTrackers": true,       // Block analytics (Playwright only)
    "blockHeavyResources": false,// Block images, videos, fonts (Playwright only)
    "operatingSystems": ["windows", "macos", "linux"], // OS types to simulate
    "devices": ["desktop", "mobile"] // Device types to simulate
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

### 2. Fetch Raw Content (`POST /fetch`)

Fetches the raw content of a URL and returns it as a string. This endpoint is intended for integrating external services that need the raw HTML/XML (e.g. RSS) or the rendered HTML of a SPA.

Supported engines:
- `engine=http` - Fast HTTP fetch without browser rendering
- `engine=playwright` - Full browser rendering for JavaScript-heavy sites

**Request:**
```jsonc
POST /api/v1/fetch
{
  "url": "https://example.com",
  "engine": "http",              // "http" or "playwright"
  "timeoutSecs": 60,
  "debug": false,
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    "locale": "en-US",
    "timezoneId": "UTC",
    "rotateOnAntiBot": true,
    "blockTrackers": true,       // Playwright only
    "blockHeavyResources": true  // Playwright only
  },
  "locale": "en-US",             // Browser locale (overrides fingerprint.locale)
  "timezoneId": "UTC"            // Timezone ID (overrides fingerprint.timezoneId)
}
```

**Response (200 OK):**
```jsonc
{
  "finalUrl": "https://example.com",
  "content": "<!doctype html><html>...</html>",
  "detectedContentType": "text/html; charset=utf-8",
  "meta": {
    "durationMs": 123,
    "engine": "http",              // or "playwright"
    "attempts": 1,
    "wasAntibot": false,
    "statusCode": 200
  }
}
```

**Error Response (4xx/5xx):**
```jsonc
{
  "finalUrl": "https://example.com",
  "meta": {
    "durationMs": 123,
    "engine": "http",
    "attempts": 1,
    "wasAntibot": false,
    "statusCode": 404
  },
  "error": {
    "code": "FETCH_HTTP_STATUS",
    "message": "Upstream returned HTTP 404",
    "retryable": false,
    "stack": "..."                // Only included when debug=true
  }
}
```

**Notes:**
- The service enforces SSRF protections and blocks private/metadata IP ranges.
- `engine=http`: Fast HTTP fetch, follows redirects up to a fixed limit, responses are size-limited.
  - Only accepts text content types (text/*, application/xml, application/rss+xml, application/atom+xml, application/json, application/ld+json)
  - Rejects binary content (images, videos, PDFs) with `FETCH_UNSUPPORTED_CONTENT_TYPE` error
- `engine=playwright`: Full browser rendering with anti-bot protection, supports JavaScript-heavy sites.
- `timeoutSecs` is a total budget for the entire operation including retries (and redirects for `engine=http`).
- `rotateOnAntiBot=true` rotates fingerprint only when anti-bot protection is detected.
- Use `debug=true` to include stack traces in error responses (and response headers in successful responses).

**Common error codes:**
- `FETCH_TOO_MANY_REDIRECTS` (HTTP 508) when redirect limit is exceeded
- `FETCH_RESPONSE_TOO_LARGE` (HTTP 413) when response exceeds size limits

**Note:** Upstream non-2xx HTTP responses are returned as `FETCH_HTTP_STATUS` with HTTP 502.

### 3. Health Check (`GET /health`)

**Response:** `{"status": "ok"}`

---

## Operational Details

### Concurrency Management
- **Global Limiter:** Uses an in-memory concurrency limiter (`MAX_CONCURRENCY`). All scraping requests share this limit to prevent resource exhaustion.
- **Queue System:** When the limit is reached, new tasks wait in a queue until a slot becomes available.

### Data Lifecycle
- **In-Memory Storage:** Page data is stored in memory for quick access.
- **Automatic Cleanup:** Data is automatically purged after `DATA_LIFETIME_MINS` (default 60 minutes).
- **Cleanup Interval:** Cleanup runs every `CLEANUP_INTERVAL_MINS` (default 10 minutes).

### Anti-Bot Protection
- **Browser Fingerprints:** 
  - Generates realistic browser profiles (User-Agent, screen size, locale, timezone) to mimic real devices.
  - Supports multiple operating systems and device types via Chromium engine.
  - Customizable via `fingerprint` settings per request (operatingSystems, devices).
- **Resource Blocking:** 
  - **Trackers:** Blocks analytics scripts (Google Analytics, Facebook Pixel, etc.) to speed up loading and reduce detection.
  - **Heavy Resources:** Optionally blocks images, videos, and fonts to minimize bandwidth and improve performance.
- **Adaptive Behavior:**
  - **Fingerprint Rotation:** When `rotateOnAntiBot` is enabled, automatically generates a new fingerprint if bot detection is suspected.

### Error Handling
- **Timeouts:** Each scraping task has a configurable timeout (`taskTimeoutSecs`). Tasks exceeding this limit are terminated.
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
    "fingerprint": {
      "locale": "ru-RU",
      "timezoneId": "Europe/Moscow",
      "blockTrackers": true,
      "blockHeavyResources": true,
      "operatingSystems": ["linux"]
    }
  }'
```

### Example 3: Get Rendered HTML for Custom Processing
```bash
curl -X POST http://localhost:8080/api/v1/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://spa-app.com",
    "engine": "playwright",
    "timeoutSecs": 60,
    "fingerprint": {
      "blockTrackers": true
    }
  }'
```

### Example 4: Mobile Device Simulation
```bash
curl -X POST http://localhost:8080/api/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://mobile-site.com",
    "mode": "playwright",
    "fingerprint": {
      "operatingSystems": ["android"],
      "devices": ["mobile"],
      "locale": "en-US"
    }
  }'
```

---


## Limitations and Best Practices

### Limitations
- **In-Memory Storage:** Page data is stored in memory. Service restarts will clear all cached data.
- **No Persistence:** Data is automatically deleted after `DATA_LIFETIME_MINS`.
- **Concurrency Limit:** The global `MAX_CONCURRENCY` limit applies to all requests. High concurrency may require scaling.

### Best Practices
- **Use Extractor Mode First:** Start with `extractor` mode for faster performance. Switch to `playwright` only for JavaScript-heavy sites.
- **Set Appropriate Timeouts:** Adjust `taskTimeoutSecs` based on target site complexity. Longer timeouts for slow sites.
- **Block Resources:** Enable `fingerprint.blockTrackers` and `fingerprint.blockHeavyResources` for faster scraping when images/videos aren't needed.
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