# Page Scraper Microservice

A NestJS-based microservice for extracting structured data from web pages with support for both static (Cheerio) and dynamic (Playwright) content scraping.

## Features

- **Dual-mode scraping**: Support for both Cheerio (static) and Playwright (dynamic) scraping
- **Batch processing**: Handle multiple URLs with configurable delays and concurrency
- **Webhook notifications**: Automatic notifications for batch job completion
- **Content extraction**: Intelligent article content extraction with Markdown conversion
- **Anti-bot protection**: Configurable fingerprint generation and rotation
- **Resource blocking**: Block trackers and heavy resources for faster scraping
- **Job management**: In-memory job tracking with automatic cleanup
- **Comprehensive error handling**: Detailed error responses with proper HTTP status codes

## Technology Stack

- **NestJS** - Framework for efficient and scalable server-side applications
- **Fastify** - High-performance HTTP server
- **Crawlee** - Web scraping framework with queue management
- **@extractus/article-extractor** - Article content extraction library
- **Playwright** - Browser automation for dynamic content
- **Turndown** - HTML to Markdown conversion
- **TypeScript** - Type-safe development

## Installation

```bash
# Install dependencies
pnpm install

# or with npm
npm install
```

## Environment Configuration

### Basic Settings

```bash
NODE_ENV=development                    # Environment mode
LISTEN_HOST=localhost                    # Server host
LISTEN_PORT=3000                       # Server port
API_BASE_PATH=api                      # API prefix
LOG_LEVEL=debug                         # Logging level
TZ=UTC                                 # Timezone
```

### Scraper Settings

```bash
DEFAULT_MODE=cheerio                    # Default scraping mode
DEFAULT_TASK_TIMEOUT_SECS=30            # Task timeout in seconds
DEFAULT_USER_AGENT=auto                  # Default user agent
DEFAULT_LOCALE=en-US                    # Default locale
DEFAULT_TIMEZONE_ID=UTC                 # Default timezone
DEFAULT_DATE_LOCALE=en                  # Date parsing locale
```

### Playwright Settings

```bash
PLAYWRIGHT_HEADLESS=true                 # Run without GUI
PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS=30    # Navigation timeout
PLAYWRIGHT_BLOCK_TRACKERS=true           # Block trackers
PLAYWRIGHT_BLOCK_HEAVY_RESOURCES=true    # Block heavy resources
```

### Fingerprint Settings

```bash
FINGERPRINT_GENERATE=true                # Generate fingerprints
FINGERPRINT_ROTATE_ON_ANTI_BOT=true    # Rotate on anti-bot detection
```

### Batch Processing Settings

```bash
BATCH_MIN_DELAY_MS=1500                 # Minimum delay between requests
BATCH_MAX_DELAY_MS=4000                 # Maximum delay between requests
BATCH_CONCURRENCY=1                     # Concurrent requests
BATCH_MAX_ITEMS=100                     # Maximum items per batch
BATCH_DATA_LIFETIME_MINS=60             # Data retention time
```

### Webhook Settings

```bash
WEBHOOK_TIMEOUT_MS=10000                 # Webhook timeout
WEBHOOK_BACKOFF_MS=1000                 # Retry backoff
WEBHOOK_MAX_ATTEMPTS=3                  # Maximum retry attempts
```

## Running the Application

### Development

```bash
# Start in development mode
pnpm run start:dev

# or with npm
npm run start:dev
```

### Production

```bash
# Build the application
pnpm run build

# Start in production mode
pnpm run start:prod

# or with npm
npm run build
npm run start:prod
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t page-scraper-microservice .
docker run -p 3000:3000 page-scraper-microservice
```

## API Endpoints

### Base URL
```
/{API_BASE_PATH}/v1
```

### 1. Scrape Single Page

**POST** `/page`

Extract content from a single web page.

#### Request Body
```json
{
  "url": "https://example.com/article",
  "mode": "cheerio|playwright",
  "taskTimeoutSecs": 30,
  "locale": "en-US",
  "dateLocale": "en",
  "timezoneId": "UTC",
  "blockTrackers": true,
  "blockHeavyResources": true,
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    "locale": "source",
    "timezoneId": "source",
    "rotateOnAntiBot": true,
    "generator": {
      "browsers": ["chrome"]
    }
  }
}
```

#### Response
```json
{
  "url": "https://example.com/article",
  "title": "Article title",
  "description": "Optional description",
  "date": "2024-11-12T10:00:00.000Z",
  "author": "John Doe",
  "body": "# Article title\n\nMarkdown content ...",
  "meta": {
    "lang": "en",
    "readTimeMin": 5
  }
}
```

### 2. Create Batch Job

**POST** `/batch`

Process multiple URLs with delays and webhook notifications.

#### Request Body
```json
{
  "items": [
    { "url": "https://site1.com/a1", "mode": "playwright" },
    { "url": "https://site2.com/a2" }
  ],
  "commonSettings": {
    "mode": "cheerio",
    "taskTimeoutSecs": 30,
    "locale": "en-US",
    "timezoneId": "UTC",
    "dateLocale": "en",
    "blockTrackers": true,
    "blockHeavyResources": true,
    "fingerprint": {
      "generate": true,
      "userAgent": "auto",
      "locale": "source",
      "timezoneId": "source",
      "rotateOnAntiBot": true,
      "generator": {
        "browsers": ["chrome"]
      }
    }
  },
  "schedule": {
    "minDelayMs": 1500,
    "maxDelayMs": 4000,
    "jitter": true,
    "concurrency": 1
  },
  "webhook": {
    "url": "https://example.com/webhook",
    "headers": { "X-Source": "page-scraper" },
    "authHeaderName": "Authorization",
    "authHeaderValue": "Bearer <token>",
    "backoffMs": 1000,
    "maxAttempts": 3
  }
}
```

#### Response
```json
{ "jobId": "b-20241112-abcdef" }
```

### 3. Get Batch Job Status

**GET** `/batch/:id`

Check the status of a batch job.

#### Response
```json
{
  "jobId": "b-20241112-abcdef",
  "status": "running|queued|succeeded|failed|partial",
  "createdAt": "2024-11-12T10:00:00.000Z",
  "completedAt": "2024-11-12T10:15:00.000Z",
  "total": 10,
  "processed": 4,
  "succeeded": 3,
  "failed": 1
}
```

#### Job Statuses
- `queued` - Job is in queue and waiting to be processed
- `running` - Job is currently being processed
- `succeeded` - Job completed successfully
- `failed` - Job failed completely
- `partial` - Job completed with some failures

### 4. Health Check

**GET** `/health`

Check the health status of the microservice.

## Error Handling

The service returns appropriate HTTP status codes and detailed error messages:

```json
{
  "error": {
    "code": 422,
    "message": "Failed to extract content from the page",
    "details": "Page structure is not recognizable as an article"
  }
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `404` - Not Found (job not found)
- `422` - Unprocessable Entity (content extraction failed)
- `500` - Internal Server Error
- `504` - Gateway Timeout (request timeout)

## Webhook Payload

When a batch job completes, a webhook is sent with the following payload:

```json
{
  "jobId": "b-20241112-abcdef",
  "status": "succeeded|failed|partial",
  "createdAt": "2024-11-12T10:00:00.000Z",
  "completedAt": "2024-11-12T10:15:00.000Z",
  "total": 10,
  "processed": 10,
  "succeeded": 9,
  "failed": 1,
  "results": [
    {
      "url": "https://site1.com/a1",
      "status": "succeeded",
      "data": {
        "url": "https://site1.com/a1",
        "title": "Article title",
        "description": "Optional description",
        "date": "2024-11-12T10:00:00.000Z",
        "author": "John Doe",
        "body": "# Article title\n\nMarkdown content ...",
        "meta": {
          "lang": "en",
          "readTimeMin": 5
        }
      }
    },
    {
      "url": "https://site2.com/a2",
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

## Development

### Running Tests

```bash
# Run all tests
pnpm run test

# Run unit tests only
pnpm run test:unit

# Run e2e tests only
pnpm run test:e2e

# Run with coverage
pnpm run test:cov
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Format code
pnpm run format
```

## Architecture

The microservice follows a modular architecture:

```
src/
├── modules/
│   ├── scraper/
│   │   ├── dto/                    # Data transfer objects
│   │   ├── services/               # Business logic
│   │   ├── scraper.controller.ts    # API endpoints
│   │   └── scraper.module.ts       # Module configuration
│   └── health/                    # Health check module
├── config/                       # Configuration files
├── common/                       # Shared utilities
└── app.module.ts                 # Root module
```

## Security Considerations

- All requests are validated using class-validator decorators
- Authentication headers in webhooks are supported
- Resource blocking prevents loading of potentially malicious content
- Configurable timeouts prevent resource exhaustion
- No data persistence - all data is temporary and cleaned up

## Performance

- Concurrent processing for batch jobs
- Configurable delays to avoid rate limiting
- Resource blocking for faster page loads
- Memory cleanup after job completion
- Efficient queue management

## Limitations

- No image extraction (planned for future versions)
- In-memory job storage (not suitable for distributed deployment)
- No built-in rate limiting beyond batch delays
- No caching of scraped content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
