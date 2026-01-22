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
  - Supports same fingerprint configuration as `/html` endpoint

### Changed
- **POST /fetch endpoint**: Now supports both `http` and `playwright` engines
  - `engine=http`: Fast HTTP fetch without browser (existing functionality)
  - `engine=playwright`: Browser-based fetch with anti-bot measures (new)

## [1.1.0] - Previous releases

See git history for earlier changes.
