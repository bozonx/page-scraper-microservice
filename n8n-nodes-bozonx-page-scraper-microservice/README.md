# n8n-nodes-bozonx-page-scraper-microservice

n8n community node for the [Page Scraper microservice](https://github.com/bozonx/page-scraper-microservice). Extract structured content from web pages and retrieve raw HTML.

## Installation

### Via n8n UI (Recommended)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-bozonx-page-scraper-microservice`
4. Click **Install**

### Via npm

```bash
npm install n8n-nodes-bozonx-page-scraper-microservice
```

## Prerequisites

You need a running instance of the [Page Scraper microservice](https://github.com/bozonx/page-scraper-microservice).

**Quick start with Docker:**

```bash
docker run -d -p 8080:8080 bozonx/page-scraper-microservice:latest
```

## Credentials

Configure **Bozonx Microservices API** credentials:

- **Gateway URL**: Microservice base URL (e.g., `http://localhost:8080`)
- **API Token** (optional): Bearer token if authentication is enabled

## Operations

### Scrape Page

Extract structured article content (title, author, date, body in Markdown).

**Key parameters:**
- **URL**: Target page
- **Mode**: `extractor` (fast) or `playwright` (JavaScript support)
- **Fingerprint Options**: Anti-bot detection avoidance

### Fetch Content

Retrieve raw content from URLs (HTML/XML/RSS) using HTTP or Playwright engine.

## Resources

- [Microservice Repository](https://github.com/bozonx/page-scraper-microservice) - Deployment and API documentation
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/) - Installation guide

## Compatibility

- n8n: 0.220.0+
- Node.js: 18.x+

## License

MIT
