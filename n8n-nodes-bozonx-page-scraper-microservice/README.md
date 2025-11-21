# n8n-nodes-bozonx-page-scraper-microservice

This is an n8n community node for the BozonX Page Scraper microservice. It provides web scraping capabilities with support for single-page extraction, raw HTML retrieval, and batch processing.

## Features

- **Scrape Page**: Extract structured article content from web pages
- **Get HTML**: Retrieve raw HTML content using browser automation
- **Create Batch**: Process multiple URLs asynchronously
- **Get Batch Status**: Monitor and retrieve batch job results

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-bozonx-page-scraper-microservice` in **Enter npm package name**
4. Agree to the risks and select **Install**

### Manual Installation

```bash
npm install n8n-nodes-bozonx-page-scraper-microservice
```

## Credentials

This node uses the **Bozonx Microservices API** credential type.

### Configuration

- **Gateway URL**: Base URL of your Page Scraper microservice (without `/api/v1`)
  - Example: `https://api.example.com` or `http://localhost:8080`
- **API Token** (optional): Bearer token for Authorization header if your deployment requires authentication

## Operations

### Scrape Page

Extracts structured article content from a single web page.

**Parameters:**
- **URL** (required): Target page URL to scrape
- **Scraper Mode**: 
  - `extractor`: Fast static HTML extraction
  - `playwright`: Full browser rendering with JavaScript support
- **Raw Body**: Return body without Markdown conversion
- **Additional Options**:
  - Task Timeout (seconds)
  - Locale
  - Date Locale
  - Timezone ID
  - Block Trackers
  - Block Heavy Resources
- **Fingerprint Options**:
  - Generate Fingerprint
  - User Agent
  - Fingerprint Locale
  - Fingerprint Timezone
  - Rotate On Anti-Bot
  - Allowed Browsers

**Output:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "description": "Article description",
  "date": "2024-05-30T10:00:00.000Z",
  "author": "Author Name",
  "body": "Article content in Markdown...",
  "meta": {
    "lang": "en",
    "readTimeMin": 5,
    "rawBody": false
  }
}
```

### Get HTML

Retrieves raw HTML content from a web page using Playwright browser automation.

**Parameters:**
- **URL** (required): Target page URL
- **Additional Options**: Same as Scrape Page (except Date Locale)
- **Fingerprint Options**: Same as Scrape Page

**Output:**
```json
{
  "url": "https://example.com/page",
  "html": "<!DOCTYPE html><html>...</html>"
}
```

### Create Batch

Creates an asynchronous batch scraping job for processing multiple URLs.

**Parameters:**
- **Items**: List of URLs to scrape with optional mode override
- **Common Settings**: Default settings applied to all items
  - Mode
  - Task Timeout (seconds)
  - Raw Body
  - Locale
  - Timezone ID
- **Schedule Options**: Control request pacing
  - Min Delay (ms): 500-3600000, default 1500
  - Max Delay (ms): 1000-3600000, default 4000
  - Jitter: Add ±20% random variation
- **Webhook Options**: Notification when job completes
  - Webhook URL
  - Headers (for authentication)
  - Backoff (ms): 100-600000, default 1000
  - Max Attempts: 1-100, default 3

**Output:**
```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a"
}
```

### Get Batch Status

Retrieves the current status and results of a batch scraping job.

**Parameters:**
- **Job ID** (required): Batch job identifier from Create Batch

**Output:**
```json
{
  "jobId": "0f1c5d8e-3d4b-4c0f-8f0c-5c2d2d7b9c6a",
  "status": "succeeded",
  "createdAt": "2024-05-30T10:00:00.000Z",
  "completedAt": "2024-05-30T10:05:00.000Z",
  "total": 5,
  "processed": 5,
  "succeeded": 5,
  "failed": 0,
  "statusMeta": {
    "succeeded": 5,
    "failed": 0,
    "message": null
  }
}
```

## Usage Examples

### Example 1: Simple Page Scraping

1. Add **Page Scraper** node
2. Select **Scrape Page** operation
3. Enter URL: `https://example.com/article`
4. Choose **Extractor** mode for fast scraping
5. Execute

### Example 2: Batch Processing with Webhook

1. Add **Page Scraper** node
2. Select **Create Batch** operation
3. Add multiple items with URLs
4. Configure common settings (mode, timeout, locale)
5. Set schedule delays (e.g., 2000-5000ms)
6. Add webhook URL for notification
7. Execute to get job ID
8. Use **Get Batch Status** to check progress

### Example 3: Raw HTML Extraction

1. Add **Page Scraper** node
2. Select **Get HTML** operation
3. Enter URL
4. Configure fingerprint options to avoid detection
5. Execute to get rendered HTML

## Microservice Setup

This node requires a running instance of the Page Scraper microservice. See the [main repository](https://github.com/bozonx/page-scraper-microservice) for deployment instructions.

**Quick Start with Docker:**

```bash
docker run -d \
  -p 8080:8080 \
  -e MAX_CONCURRENCY=3 \
  -e DEFAULT_TASK_TIMEOUT_SECS=30 \
  bozonx/page-scraper-microservice:latest
```

## API Reference

For complete API documentation, see [docs/api.md](https://github.com/bozonx/page-scraper-microservice/blob/main/docs/api.md) in the microservice repository.

## Error Handling

The node returns structured error responses:

```json
{
  "error": {
    "code": 422,
    "message": "Failed to extract content from page",
    "details": "Page structure is not recognizable as an article"
  }
}
```

Enable **Continue On Fail** in node settings to handle errors gracefully in workflows.

## Compatibility

- n8n version: 0.220.0 or later
- Node.js version: 18.x or later

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Page Scraper Microservice Repository](https://github.com/bozonx/page-scraper-microservice)
- [API Documentation](https://github.com/bozonx/page-scraper-microservice/blob/main/docs/api.md)

## License

MIT

## Version History

### 0.1.0
- Initial release
- Support for page scraping, HTML retrieval, and batch processing
- Configurable fingerprinting and anti-bot features
- Webhook notifications for batch jobs
