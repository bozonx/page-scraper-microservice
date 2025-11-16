# Page Scraper Microservice API Documentation

## Base URL
```
/{API_BASE_PATH}/v1
```

## Overview

The Page Scraper Microservice provides REST API endpoints for extracting structured content from web pages. It supports both single page scraping and batch processing with webhook notifications.

## 1. Scrape Single Page

**POST** `/page`

Extract content from a single web page.

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | URL of the page to scrape |
| mode | string | No | "cheerio" | Scraping mode: "cheerio" (static) or "playwright" (dynamic) |
| taskTimeoutSecs | number | No | 30 | Timeout in seconds (1-300) |
| locale | string | No | "en-US" | Locale for content extraction |
| dateLocale | string | No | "en" | Locale for date parsing |
| timezoneId | string | No | "UTC" | Timezone for date parsing |
| blockTrackers | boolean | No | true | Block tracking scripts and analytics |
| blockHeavyResources | boolean | No | true | Block images, videos, and other heavy resources |
| fingerprint | object | No | - | Browser fingerprint configuration |

#### Fingerprint Configuration

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| generate | boolean | No | true | Enable fingerprint generation |
| userAgent | string | No | "auto" | User agent string ("auto" for random selection) |
| locale | string | No | "source" | Browser locale ("source" for random selection) |
| timezoneId | string | No | "source" | Browser timezone ("source" for random selection) |
| rotateOnAntiBot | boolean | No | true | Rotate fingerprint when anti-bot is detected |
| generator | object | No | - | Fingerprint generator options |

#### Fingerprint Generator Options

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| browsers | array | No | ["chrome"] | List of browsers to simulate |

### Request Example

```json
{
  "url": "https://example.com/article",
  "mode": "playwright",
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

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| url | string | Original URL |
| title | string | Extracted page title |
| description | string | Extracted page description |
| date | string | Publication date (ISO 8601) |
| author | string | Extracted author name |
| body | string | Content converted to Markdown |
| meta | object | Additional metadata |

#### Metadata Object

| Parameter | Type | Description |
|-----------|------|-------------|
| lang | string | Page language code |
| readTimeMin | number | Estimated reading time in minutes |

### Response Example

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

## 2. Create Batch Job

**POST** `/batch`

Process multiple URLs with delays and webhook notifications.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| items | array | Yes | Array of URLs to process |
| commonSettings | object | No | Default settings for all items |
| schedule | object | No | Batch processing schedule |
| webhook | object | No | Webhook configuration |

#### Batch Items

Each item in the `items` array can have:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| url | string | Yes | - | URL of the page to scrape |
| mode | string | No | "cheerio" | Scraping mode: "cheerio" or "playwright" |

#### Common Settings

Same parameters as single page scraping, applied to all items unless overridden.

#### Schedule Configuration

| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| minDelayMs | number | No | 1500 | 500-30000 | Minimum delay between requests |
| maxDelayMs | number | No | 4000 | 1000-60000 | Maximum delay between requests |
| jitter | boolean | No | true | - | Add random jitter to delays |
| concurrency | number | No | 1 | 1-10 | Number of concurrent requests |

#### Webhook Configuration

| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| url | string | Yes | - | - | Webhook URL |
| headers | object | No | - | - | Additional headers |
| authHeaderName | string | No | - | - | Authentication header name |
| authHeaderValue | string | No | - | - | Authentication header value |
| backoffMs | number | No | 1000 | 100-30000 | Backoff delay between retries |
| maxAttempts | number | No | 3 | 1-10 | Maximum retry attempts |

### Request Example

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

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| jobId | string | Unique identifier for the batch job |

### Response Example

```json
{ "jobId": "b-20241112-abcdef" }
```

## 3. Get Batch Job Status

**GET** `/batch/:id`

Check the status of a batch job.

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| jobId | string | Unique identifier for the batch job |
| status | string | Current job status |
| createdAt | string | Job creation timestamp (ISO 8601) |
| completedAt | string | Job completion timestamp (ISO 8601) |
| total | number | Total number of items |
| processed | number | Number of processed items |
| succeeded | number | Number of successfully processed items |
| failed | number | Number of failed items |

### Job Statuses

| Status | Description |
|--------|-------------|
| `queued` | Job is in queue and waiting to be processed |
| `running` | Job is currently being processed |
| `succeeded` | Job completed successfully (all items succeeded) |
| `failed` | Job failed completely (all items failed) |
| `partial` | Job completed with some failures (mixed success/failure) |

### Response Example

```json
{
  "jobId": "b-20241112-abcdef",
  "status": "running",
  "createdAt": "2024-11-12T10:00:00.000Z",
  "completedAt": "2024-11-12T10:15:00.000Z",
  "total": 10,
  "processed": 4,
  "succeeded": 3,
  "failed": 1
}
```

## 4. Health Check

**GET** `/health`

Check the health status of the microservice.

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Health status ("ok" or "error") |
| timestamp | string | Current timestamp (ISO 8601) |
| uptime | number | Service uptime in seconds |

### Response Example

```json
{
  "status": "ok",
  "timestamp": "2024-11-12T10:00:00.000Z",
  "uptime": 3600
}
```

## Error Handling

The service returns appropriate HTTP status codes and detailed error messages:

### Error Response Format

```json
{
  "error": {
    "code": 422,
    "message": "Failed to extract content from the page",
    "details": "Page structure is not recognizable as an article"
  }
}
```

### Error Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| code | number | HTTP status code |
| message | string | Error message |
| details | string | Additional error details (optional) |

### Common Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `400` | Bad Request | Validation errors or malformed request |
| `404` | Not Found | Batch job not found |
| `422` | Unprocessable Entity | Content extraction failed |
| `500` | Internal Server Error | Unexpected server error |
| `502` | Bad Gateway | Browser engine error |
| `504` | Gateway Timeout | Request timeout |

### Validation Errors

Validation errors include details about which fields failed validation:

```json
{
  "error": {
    "code": 400,
    "message": "Validation failed",
    "details": [
      "url must be a valid URL",
      "mode must be either 'cheerio' or 'playwright'",
      "taskTimeoutSecs must not be greater than 300"
    ]
  }
}
```

## Webhook Payload

When a batch job completes, a webhook is sent with the following payload:

### Webhook Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| jobId | string | Unique identifier for the batch job |
| status | string | Final job status |
| createdAt | string | Job creation timestamp (ISO 8601) |
| completedAt | string | Job completion timestamp (ISO 8601) |
| total | number | Total number of items |
| processed | number | Number of processed items |
| succeeded | number | Number of successfully processed items |
| failed | number | Number of failed items |
| results | array | Array of item results |

### Item Result Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| url | string | Original URL |
| status | string | Item status ("succeeded" or "failed") |
| data | object | Extracted data (for successful items) |
| error | object | Error details (for failed items) |

### Webhook Example

```json
{
  "jobId": "b-20241112-abcdef",
  "status": "partial",
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

## Rate Limiting and Throttling

The microservice implements several mechanisms to prevent overwhelming target servers:

1. **Batch Delays**: Configurable minimum and maximum delays between requests
2. **Concurrency Limits**: Maximum number of concurrent requests
3. **Jitter**: Random variation in delays to prevent pattern detection
4. **Resource Blocking**: Optional blocking of heavy resources to reduce server load

## Data Lifetime

Batch job data is retained in memory for a configurable period (default: 60 minutes) and then automatically cleaned up. Job data includes:

- Job status and metadata
- Processing results
- Error details

After cleanup, attempts to retrieve job status will return a 404 error.

## Security Considerations

1. **Input Validation**: All inputs are validated using class-validator decorators
2. **Timeout Protection**: Configurable timeouts prevent resource exhaustion
3. **Resource Blocking**: Optional blocking of potentially malicious content
4. **No Data Persistence**: All data is temporary and cleaned up automatically
5. **Webhook Authentication**: Support for authentication headers in webhook requests