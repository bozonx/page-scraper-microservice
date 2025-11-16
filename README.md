# Page Scraper Microservice

A NestJS-based microservice for extracting structured data from web pages with support for both static (Cheerio) and dynamic (Playwright) content scraping.

## Overview

The Page Scraper Microservice is designed to extract structured content from web pages and convert it to a clean, readable format. It supports both static content extraction using Cheerio and dynamic content extraction using Playwright for JavaScript-heavy websites.

### Key Capabilities

- **Content Extraction**: Automatically extracts article content including title, description, author, publication date, and body text
- **Format Conversion**: Converts HTML content to clean Markdown format for better readability and processing
- **Metadata Extraction**: Extracts additional metadata such as language, estimated reading time, and publication information
- **Dual-Mode Operation**: Supports both fast static scraping (Cheerio) and full browser rendering (Playwright)
- **Batch Processing**: Process multiple URLs simultaneously with configurable delays and concurrency controls
- **Anti-Bot Protection**: Advanced fingerprint generation and rotation to avoid detection by anti-bot systems
- **Resource Optimization**: Configurable blocking of trackers, ads, and heavy resources for faster scraping
- **Webhook Integration**: Automatic notifications when batch jobs complete with detailed results

### Use Cases

- **Content Aggregation**: Extract articles from multiple sources for content aggregation platforms
- **Research & Analysis**: Collect structured data from websites for research and analysis
- **Content Monitoring**: Monitor websites for new content and changes
- **Data Migration**: Extract content from legacy websites for migration to new platforms
- **Archive Creation**: Create structured archives of web content

## Quick Start

### Single Page Scraping

```bash
curl -X POST http://localhost:8080/api/v1/page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "mode": "playwright"
  }'
```

### Batch Processing

```bash
curl -X POST http://localhost:8080/api/v1/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "url": "https://example.com/article1" },
      { "url": "https://example.com/article2", "mode": "playwright" }
    ],
    "webhook": {
      "url": "https://your-app.com/webhook"
    }
  }'
```

## API Documentation

For detailed API documentation including endpoints, request/response formats, and error handling, see [docs/api.md](docs/api.md).

## Architecture

The microservice follows a modular architecture with clear separation of concerns:

```
src/
├── modules/
│   ├── scraper/
│   │   ├── dto/                    # Data transfer objects
│   │   ├── services/               # Business logic
│   │   │   ├── scraper.service.ts  # Core scraping functionality
│   │   │   ├── batch.service.ts    # Batch processing
│   │   │   ├── fingerprint.service.ts # Anti-bot protection
│   │   │   └── webhook.service.ts  # Webhook notifications
│   │   ├── scraper.controller.ts   # API endpoints
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

---

## Development Guide

### Installation

```bash
# Install dependencies
pnpm install

# or with npm
npm install
```

### Environment Configuration

#### Basic Settings

```bash
NODE_ENV=development                    # Environment mode
LISTEN_HOST=localhost                    # Server host
LISTEN_PORT=3000                       # Server port
API_BASE_PATH=api                      # API prefix
LOG_LEVEL=debug                         # Logging level
TZ=UTC                                 # Timezone
```

#### Scraper Settings

```bash
DEFAULT_MODE=cheerio                    # Default scraping mode
DEFAULT_TASK_TIMEOUT_SECS=30            # Task timeout in seconds
DEFAULT_USER_AGENT=auto                  # Default user agent
DEFAULT_LOCALE=en-US                    # Default locale
DEFAULT_TIMEZONE_ID=UTC                 # Default timezone
DEFAULT_DATE_LOCALE=en                  # Date parsing locale
```

#### Playwright Settings

```bash
PLAYWRIGHT_HEADLESS=true                 # Run without GUI
PLAYWRIGHT_NAVIGATION_TIMEOUT_SECS=30    # Navigation timeout
PLAYWRIGHT_BLOCK_TRACKERS=true           # Block trackers
PLAYWRIGHT_BLOCK_HEAVY_RESOURCES=true    # Block heavy resources
```

#### Fingerprint Settings

```bash
FINGERPRINT_GENERATE=true                # Generate fingerprints
FINGERPRINT_ROTATE_ON_ANTI_BOT=true    # Rotate on anti-bot detection
```

#### Batch Processing Settings

```bash
BATCH_MIN_DELAY_MS=1500                 # Minimum delay between requests
BATCH_MAX_DELAY_MS=4000                 # Maximum delay between requests
BATCH_CONCURRENCY=1                     # Concurrent requests
BATCH_MAX_ITEMS=100                     # Maximum items per batch
BATCH_DATA_LIFETIME_MINS=60             # Data retention time
```

#### Webhook Settings

```bash
WEBHOOK_TIMEOUT_MS=10000                 # Webhook timeout
WEBHOOK_BACKOFF_MS=1000                 # Retry backoff
WEBHOOK_MAX_ATTEMPTS=3                  # Maximum retry attempts
```

### Running the Application

#### Development

```bash
# Start in development mode
pnpm run start:dev

# or with npm
npm run start:dev
```

#### Production

```bash
# Build the application
pnpm run build

# Start in production mode
pnpm run start:prod

# or with npm
npm run build
npm run start:prod
```

#### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t page-scraper-microservice .
docker run -p 3000:3000 page-scraper-microservice
```

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
