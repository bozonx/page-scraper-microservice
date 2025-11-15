# Page Scraper Microservice API Documentation

## Base URL
```
/{API_BASE_PATH}/v1
```

## 1. Scrape Single Page

**POST** `/page`

Extract content from a single web page.

### Request Body
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

### Response
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

### Request Body
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

### Response
```json
{ "jobId": "b-20241112-abcdef" }
```

## 3. Get Batch Job Status

**GET** `/batch/:id`

Check the status of a batch job.

### Response
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

### Job Statuses
- `queued` - Job is in queue and waiting to be processed
- `running` - Job is currently being processed
- `succeeded` - Job completed successfully
- `failed` - Job failed completely
- `partial` - Job completed with some failures

## 4. Health Check

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