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

## API Documentation

For detailed API documentation including endpoints, request/response formats, and error handling, see [docs/api.md](docs/api.md).

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
