# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **POST /fetch endpoint**: Playwright engine support (`engine=playwright`)
  - Full browser rendering for JavaScript-heavy sites
  - Anti-bot protection with fingerprint injection
  - Resource blocking (trackers, heavy resources)
  - SSRF validation before navigation
  - Returns rendered HTML via `page.content()`
  - Supports same fingerprint configuration as `/page` endpoint
- **Content-type validation**: Rejects binary content (images, videos, PDFs) for `engine=http`
  - Allows only text/* and application/xml|rss+xml|atom+xml|json|ld+json
  - Returns `FETCH_UNSUPPORTED_CONTENT_TYPE` error for binary data

### Changed
- **POST /fetch endpoint**: Now supports both `http` and `playwright` engines
  - `engine=http`: Fast HTTP fetch without browser (existing functionality)
  - `engine=playwright`: Browser-based fetch with anti-bot measures (new)
- **Timeout semantics**: `timeoutSecs` now enforces total budget for entire operation
  - Includes all redirects and retry attempts for `engine=http`
  - Prevents timeout multiplication across retries
- **Fingerprint rotation**: Fixed `rotateOnAntiBot` logic
  - Now rotates fingerprint only when anti-bot is detected AND `rotateOnAntiBot=true`
  - Previously rotated on every retry regardless of anti-bot detection

### Improved
- **Error codes**: More precise error categorization
  - Added `FETCH_INVALID_REQUEST` for client errors (invalid URL, unsupported protocol)
  - Added `FETCH_UNSUPPORTED_CONTENT_TYPE` for binary content rejection
  - Added `FETCH_ABORTED` for request cancellation
  - `FETCH_BROWSER_ERROR` now only for actual browser/navigation errors
  - Generic errors use `FETCH_ERROR` instead of misusing browser error code

## [1.1.0] - 2026-01-22

### Added
- Initial implementation of POST /fetch endpoint with `engine=http`
- SSRF protection for public API usage
- Retry logic with exponential backoff and Retry-After support
- Configurable redirects, response size limits, and timeouts

See git history for earlier changes.
