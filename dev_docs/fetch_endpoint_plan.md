# План: добавить публичный эндпоинт `POST /fetch` и HTTP-движок `http`

## Цель
Сделать микросервис универсальным “fetcher”-сервисом для получения контента (HTML/RSS) с антибот-защитой.

- Внешний контракт: единый `POST /fetch`.
- Движки выполнения:
  - `http` — HTTP fetch (скачать HTML или RSS/Atom, без рендеринга).
  - `playwright` — браузерный fetch с антибот мерами.
- Парсинг/извлечение статей **не является целью `/fetch`**: news-сервис и любые другие клиенты сами решают как парсить `content`.

## Нефункциональные требования (важно для публичного использования)
- SSRF защита (запрет доступа во внутренние сети/metadata endpoints).
- Контроль ресурсов (таймауты, лимит размера ответа, лимит редиректов).
- Единый формат ошибок с возможностью дебага (stack — опционально).
- Предсказуемое поведение ретраев и backoff, включая `Retry-After`.

---

## Контракт API

### Endpoint
`POST /api/v1/fetch`

### Request
```jsonc
{
  "url": "https://example.com/page",
  "engine": "http", // "http" | "playwright"

  "timeoutSecs": 60,

  "fingerprint": {
    "generate": true,
    "devices": ["desktop"],
    "operatingSystems": ["windows"],
    "userAgent": "auto", // "auto" | "<explicit UA>"
    "rotateOnAntiBot": true,

    "blockTrackers": true,        // playwright only
    "blockHeavyResources": true   // playwright only
  },

  "locale": "ru-RU",
  "timezoneId": "Europe/Moscow",

  "debug": false
}
```

### Response (успех)
```jsonc
{
  "finalUrl": "https://example.com/page",
  "content": "<!doctype html>...", // HTML или RSS/XML
  "detectedContentType": "text/html", // опционально
  "meta": {
    "durationMs": 1234,
    "engine": "http",
    "attempts": 1,
    "wasAntibot": false,
    "statusCode": 200

    // Если debug=true: можно добавить часть безопасных данных
    // "responseHeaders": { "content-type": "text/html; charset=utf-8" }
  }
}
```

### Response (ошибка)
```jsonc
{
  "finalUrl": "https://example.com/page", // если известно
  "meta": {
    "durationMs": 1234,
    "engine": "playwright",
    "attempts": 3,
    "wasAntibot": true
  },
  "error": {
    "code": "FETCH_TIMEOUT",
    "message": "Navigation timeout",
    "retryable": true,
    "stack": "..." // только если debug=true
  }
}
```

---

## Архитектура / компоненты

### Новые DTO
- `src/modules/scraper/dto/fetch-request.dto.ts`
- `src/modules/scraper/dto/fetch-response.dto.ts`

Важно:
- `engine` — строгий enum: `http | playwright`.
- `timeoutSecs` семантически соответствует текущему `taskTimeoutSecs` (верхний лимит всей операции).
- `fingerprint` — используем текущий `FingerprintConfigDto` как базу, но в DTO для `/fetch` отделяем:
  - `locale`/`timezoneId` как отдельные поля request (как в требованиях news-сервиса).

### Новый контроллерный метод
В `ScraperController` добавить:
- `@Post('fetch')` -> вызывает `FetchService.fetch(...)`.

Рекомендуется выделить новый сервис:
- `src/modules/scraper/services/fetch.service.ts`

`FetchService` должен:
- валидировать и нормализовать параметры,
- применять SSRF ограничения,
- вызывать нужный движок,
- собирать метаданные и единый формат ошибок.

---

## Реализация движка `http` (HTTP fetch)

### Задача
`http` в данном плане означает "скачать контент по HTTP" и вернуть как строку.

### Рекомендованная библиотека
- Использовать `undici`

### Поведение
- Поддержка HTML и RSS/Atom:
  - не отбрасывать `application/rss+xml`, `application/atom+xml`, `application/xml`, `text/xml`.
- Редиректы:
  - ограничить максимум (например 5-10), сохранять `finalUrl`.
- Таймаут:
  - общий `timeoutSecs` на всю операцию.
- Лимит размера ответа:
  - защитный лимит (например 5-15MB) чтобы не убить память.
- Минимальная антибот-защита:
  - выставлять `User-Agent` и `Accept-Language` из fingerprint.
  - опционально добавить простую эвристику антибота по статусам/контенту (403/429, слова "captcha", "cloudflare" и т.д.).

### SSRF защита (обязательна)
- Запретить схемы кроме `http/https`.
- Запретить:
  - localhost/127.0.0.1
  - private ranges (10/8, 172.16/12, 192.168/16)
  - link-local, multicast
  - metadata endpoints (например 169.254.169.254)
- Делать DNS-resolve и проверять IP(ы) перед соединением (учесть DNS rebinding).

---

## Реализация движка `playwright`

### Что сохранить из текущего
- Browser pool/persistent browser (`BrowserService`).
- Ghostery blocker (по `blockTrackers`).
- Block heavy resources (по `blockHeavyResources`).
- Fingerprint injection через `fingerprint-injector` с graceful fallback.
- Корректное закрытие `page/context` при abort/timeout.

### Что добавить, чтобы соответствовать требованиям news-сервиса
- `PLAYWRIGHT_EXTRA_ARGS`:
  - добавить env и подмешивать в `chromium.launch({ args: [...] })`.
- `timezoneId`:
  - `page.emulateTimezone(timezoneId ?? TZ ?? 'UTC')`.
- Locale hardening:
  - `page.addInitScript` для `navigator.language` и `navigator.languages`.
- Headers hardening:
  - `page.setExtraHTTPHeaders({ 'Accept-Language': ..., ... })`.
- Cookie-consent autoclick:
  - после `goto` выполнить поиск по набору селекторов (OneTrust/Cookiebot + общие "Accept all").
  - ограничить время и количество попыток, не падать при ошибках.

---

## Ретраи / backoff

### Источник параметров
- Вынести/добавить в конфиг `globals.http.retryMaxAttempts` (как в требованиях news-сервиса), либо завести отдельные env для fetcher.

### Алгоритм
- Для `http` и `playwright` унифицировать ретраи:
  - `retryMaxAttempts` (например 3)
  - backoff:
    - если ответ 429/503 и есть `Retry-After` — учитывать
    - иначе экспоненциальный backoff + jitter
- Детект антибота:
  - статус 403/429
  - ключевые слова в HTML
  - специфические ошибки Playwright
- При антиботе и `fingerprint.rotateOnAntiBot=true`:
  - генерировать новый fingerprint на retry.
- В `meta.wasAntibot` отражать факт антибота хотя бы на одной попытке.

---

## Ошибки и дебаг

### Требования
- Единый объект `error` с `code/message/retryable`.
- `stack` возвращать **только** при `debug=true` (публичный API).

### Маппинг ошибок
- `FETCH_TIMEOUT`
- `FETCH_DNS_BLOCKED`
- `FETCH_SSRF_BLOCKED`
- `FETCH_HTTP_STATUS`
- `FETCH_BROWSER_ERROR`

---

## Конфиг и env

### Добавить / актуализировать env examples
Источник истины: `.env.production.example`.

Добавить:
- `PLAYWRIGHT_EXTRA_ARGS` (строка, например JSON-массив или пробел-разделение; выбранный формат зафиксировать в README).
- `FETCH_RETRY_MAX_ATTEMPTS`
- `FETCH_MAX_REDIRECTS`
- `FETCH_MAX_RESPONSE_BYTES`
- (опционально) `FETCH_DEBUG_STACK_ENABLED` (если нужно централизованно запрещать stack даже при debug).

---

## Документация

Обновить (на английском):
- `README.md`:
  - добавить секцию про `POST /fetch`.
  - подчеркнуть, что endpoint публичный и включить рекомендации по SSRF/лимитам.
- `docs/api.md` (если файл существует/будет добавлен в проект):
  - описать контракт `/fetch`.

`dev_docs` — этот файл остаётся на русском.

---

## Тесты

### Unit (`test/unit/`)
- `FetchService`:
  - SSRF блокировки (localhost, private ranges, metadata IP).
  - ретраи/backoff (моки таймеров) и учет `Retry-After`.
  - маппинг ошибок и `debug` поведение (stack только при debug).

### E2E (`test/e2e/`)
- `POST /fetch`:
  - `engine=http` возвращает HTML от тестового http-сервера.
  - RSS mime type проходит.
  - редиректы корректно обновляют `finalUrl`.

Playwright e2e тесты — по возможности ограничить (дорого/нестабильно), но минимум smoke можно оставить.

---

## Миграция news-сервиса

Рекомендованный вариант (минимальный риск):
- Fetcher возвращает `content`, а news-сервис продолжает хранить raw content у себя.

Для совместимости с текущим `request.userData` в news-сервисе:
- перенести поля 1:1 в `POST /fetch` (fingerprint/locale/timezone/timeout).
- использовать `meta.attempts` и `meta.wasAntibot` для логов/наблюдаемости.

---

## Порядок внедрения (итерации)

1) **Итерация 1: контракт + http fetch + SSRF**
- Добавить `/fetch` с `engine=http`.
- SSRF, таймаут, редиректы, лимит размера.
- Unit + E2E для http.

2) **Итерация 2: playwright fetch (без сложных эвристик)**
- Подключить `engine=playwright` на базе существующего `BrowserService`.
- Возвращать `content=page.content()`.

3) **Итерация 3: антибот hardening + ретраи/backoff**
- `PLAYWRIGHT_EXTRA_ARGS`, timezone, initScript locale hardening, extra headers.
- Cookie-consent autoclick.
- Backoff + Retry-After + meta.wasAntibot.

4) **Итерация 4: документация и совместимость**
- README/docs/api/env examples.
- Подготовить изменения в news-сервисе для перехода на `/fetch`.
