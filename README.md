# Page Scraper Microservice

A production-ready NestJS microservice designed to extract structured article data from web pages. It supports both lightweight static HTML extraction and full browser rendering via Playwright, complete with anti-bot protection, batch processing, and webhook notifications.

## Features

- **Dual Scraping Modes:** 
  - **Extractor:** Fast static HTML parsing using `@extractus/article-extractor`.
  - **Playwright:** Full Chrome/Firefox rendering for JavaScript-heavy sites.
- **Rich Data Extraction:** Captures title, description, author, date, language, main image, favicon, content type, source, outgoing links, and converts body to Markdown (or returns raw HTML).
- **Batch Processing:** Orchestrate multiple URL scrapes asynchronously with configurable delays and jitter.
- **Anti-Bot Protection:** Includes rotating browser fingerprints (User-Agent, viewport, locale) and selective resource blocking (analytics, fonts).
- **Webhooks:** reliable notification system with retries and exponential backoff upon batch completion.
- **Production Ready:** Built on Fastify with structured logging (Pino), strict validation (DTOs), and global concurrency limits.

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

| Variable | Description | Default |
| --- | --- | --- |
| `LISTEN_HOST` | Server bind address | `0.0.0.0` |
| `LISTEN_PORT` | Server port | `8080` |
| `MAX_CONCURRENCY` | Global limit for concurrent scraping tasks. | `3` |
| `DEFAULT_MODE` | Default scraper mode (`extractor` or `playwright`) | `extractor` |
| `DEFAULT_TASK_TIMEOUT_SECS` | Timeout per page scrape in seconds | `60` |
| `DATA_LIFETIME_MINS` | Retention time for in-memory results (minutes) | `60` |
| `PLAYWRIGHT_HEADLESS` | Run browser in headless mode | `true` |
| `DEFAULT_FINGERPRINT_ROTATE_ON_ANTI_BOT`| Rotate fingerprint on bot detection | `true` |

*See `.env.production.example` for the full list of available variables.*

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
  "taskTimeoutSecs": 60,         // Override default timeout
  "blockTrackers": true,         // Block analytics (Playwright only)
  "fingerprint": {               // Browser fingerprint settings
    "rotateOnAntiBot": true,
    "generator": { "browsers": ["chrome"] }
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
  "body": "# Example Article\n\nContent here...", // Markdown format
  "meta": {
    "lang": "en",
    "readTimeMin": 5
  }
  // ... other fields (favicon, source, links)
}
```

### 2. Get Raw HTML (`POST /html`)

Returns the fully rendered HTML of a page using Playwright. Useful for debug or custom parsing.

**Request:**
```jsonc
POST /api/v1/html
{
  "url": "https://example.com/dynamic-page",
  "taskTimeoutSecs": 45
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
    { "url": "https://site2.com/b", "mode": "playwright" }
  ],
  "commonSettings": {
    "taskTimeoutSecs": 30
  },
  "schedule": {
    "minDelayMs": 1000, // Random delay between requests
    "maxDelayMs": 3000
  },
  "webhook": {
    "url": "https://your-api.com/webhook",
    "headers": { "Authorization": "Bearer secret" }
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
  "status": "partial", // queued, running, succeeded, failed, partial
  "total": 2,
  "processed": 1,
  "succeeded": 1,
  "failed": 0,
  "results": [
    {
      "url": "https://site1.com/a",
      "status": "succeeded",
      "data": { ... } // Same as /page response
    }
  ]
}
```

### 5. Health Check (`GET /health`)

**Response:** `{"status": "ok"}`

---

## Webhooks

When a batch job completes (or fails), the service sends a POST request to your configured webhook URL.

**Payload:**
The payload structure mirrors the `GET /batch/:jobId` response, containing the full results of the job.

**Behavior:**
- **Retries:** Exponential backoff (default 3 attempts).
- **Timeout:** Defaults to 30 seconds.
- **Trigger:** Sent when job status becomes `succeeded`, `failed`, or `partial`.

---

## Operational Details

- **Concurrency:** Uses a global in-memory limiter (`MAX_CONCURRENCY`). All requests (single or batch) share this limit.
- **Data Lifecycle:** Results are stored in memory. They are automatically purged after `DATA_LIFETIME_MINS` (default 60 mins). **This service is stateless**; if it restarts, job history is lost.
- **Anti-Bot:**
  - **Fingerprints:** Generates realistic user info (User-Agent, screen size) to mimic real devices.
  - **Resource Blocking:** Blocks trackers and ads in Playwright to speed up loading and reduce detection.
  - **Jitter:** Batch jobs wait random intervals between requests.

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