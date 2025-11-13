# Этап 1: План реализации микросервиса Page Scraper

Микросервис для распознавания и извлечения статей по URL с использованием NestJS (Fastify), Crawlee + Playwright и @extractus/article-extractor. Выход: JSON c title, description, date, author, body (Markdown).

## Цели этапа
- Реализовать минимально жизнеспособный API для одиночного запроса распознавания страницы.
- Добавить черновую пакетную обработку c очередью и отложенным выполнением с рандомной задержкой и вебхуком по завершению.
- Обеспечить базовую наблюдаемость (логирование), валидацию входных данных и e2e/unit тесты.

## Технологический стек и ограничения
- Node.js 22, NestJS + Fastify, pnpm.
- Crawlee + Playwright (Chromium, headless по умолчанию).
- @extractus/article-extractor для извлечения статьи (HTML), последующая конверсия в Markdown (turndown).
- Без внешней БД. бд не используется в этом проекте
- Docker-образ с предустановленными зависимостями Playwright.

## Высокоуровневая архитектура
- Модуль Health (готово в проекте) — проверка живости.
- Модуль Parsing
  - `ParsingController` — HTTP API (`/v1`).
  - `ParsingService` — оркестрация Crawlee/Playwright, извлечение данных article-extractor, конверсия HTML→MD.
  - `BrowserService` — инициализация и управление контекстом Playwright для Crawlee (user-agent, таймауты, прокси опционально).
- Модуль Batch (минимум)
  - `BatchController` — `/v1/batch`.
  - `BatchService` — постановка задач в in-memory очередь, планирование задержек, агрегация результатов, вызов вебхука.
- Общие компоненты
  - Валидация DTO (class-validator), трансформация (class-transformer).
  - Логирование (pino via FastifyLogger), интерсепторы ошибок.

## Потоки данных
- Одиночная страница: HTTP POST -> Validation -> ParsingService -> Crawlee(Playwright) -> загрузка страницы -> article-extractor -> HTML->MD -> ответ 200 JSON.
- Пакет: HTTP POST -> Validation -> BatchService -> постановка N задач с задержками -> выполнение по очереди -> накопление результатов -> POST вебхук -> ответ 202 (jobId).

## Контракты API (черновик)

### POST /v1/page
Назначение: распознать одну страницу.

Request (JSON):
```json
{
  "url": "https://example.com/article",
  "options": {
    "render": true,
    "waitUntil": "domcontentloaded",
    "timeoutMs": 30000,
    "locale": "en-US",
    "timezone": "UTC",
    "userAgent": "auto|desktop|mobile|custom-string",
    "removeSelectors": ["nav", "footer", ".ads"],
    "overrideSelectors": {
      "title": "",
      "description": "",
      "author": "",
      "date": "",
      "content": ""
    }
  }
}
```

Response 200 (JSON):
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

Коды ошибок: 400 (валидация), 422 (не удалось извлечь статью), 504/502 (ошибки загрузки/таймаут Playwright), 500 (непредвиденное).

### POST /v1/batch
Назначение: распознать несколько страниц с задержкой между запросами и уведомить по вебхуку.

Request (JSON):
```json
{
  "items": [
    { "url": "https://site1.com/a1", "options": { "render": true } },
    { "url": "https://site2.com/a2" }
  ],
  "commonOptions": {
    "render": true,
    "waitUntil": "domcontentloaded",
    "timeoutMs": 30000
  },
  "schedule": {
    "minDelayMs": 1500,
    "maxDelayMs": 4000,
    "jitter": true,
    "concurrency": 1
  },
  "webhook": {
    "url": "https://example.com/webhook",
    "headers": { "X-Source": "page-scraper" }
  }
}
```

Response 202 (JSON):
```json
{ "jobId": "b-20241112-abcdef" }
```

Webhook payload (POST):
```json
{
  "jobId": "b-20241112-abcdef",
  "results": [
    { "url": "https://site1.com/a1", "ok": true, "data": { "title": "...", "body": "..." } },
    { "url": "https://site2.com/a2", "ok": false, "error": { "code": 504, "message": "Timeout" } }
  ],
  "meta": { "startedAt": "...", "finishedAt": "..." }
}
```
Коды ошибок: 400 (валидация), 422 (пустой список), 500 (непредвиденное).

Примечания:
- На Этапе 1 очередь — in-memory, результаты не сохраняются после рестарта.
- `concurrency` по умолчанию 1; задержка между элементами в интервале [minDelayMs; maxDelayMs] с рандомизацией.

## Детали реализации
- Crawlee + Playwright
  - Headless Chromium, `waitUntil` конфигурируемый (domcontentloaded/networkidle).
  - Настраиваемый User-Agent: desktop/mobile/auto/custom.
  - Таймауты навигации и селекторы удаления (удаляются из DOM перед извлечением).
  - Потенциально используем `RequestQueue`/`AutoscaledPool` Crawlee (Этап 1: упрощённо через последовательную обработку).
- Извлечение статьи
  - `@extractus/article-extractor` -> HTML/метаданные.
  - HTML → Markdown через `turndown` (минимальная конфигурация, базовые правила).
  - Чистка текста: тримминг, удаление лишних пробелов, опциональная нормализация.
- Ошибки и ретраи
  - 1–2 ретрая при сетевых/временных сбоях с экспоненциальной задержкой.
  - Явные коды и понятные сообщения.

## Конфигурация и ENV
Источник правды — `env.production.example` и `config.yaml`.
- HTTP_PORT (по умолчанию 3000)
- LOG_LEVEL (info|debug)
- PLAYWRIGHT_HEADLESS=true
- PLAYWRIGHT_TIMEOUT_MS=30000
- SCRAPER_DEFAULT_UA=auto
- BATCH_MIN_DELAY_MS=1500
- BATCH_MAX_DELAY_MS=4000
- BATCH_CONCURRENCY=1
- WEBHOOK_TIMEOUT_MS=10000

## Тестирование
- Unit (`test/unit`):
  - `ParsingService` (успешный разбор, ошибки таймаута, обработка селекторов).
  - `BatchService` (расписание задержек, агрегация результатов, вызов вебхука — моки HTTP).
- E2E (`test/e2e`):
  - `/health` (уже есть), `/v1/parse/page` позитивный/негативный кейсы.
  - `/v1/parse/batch` 202 + эмуляция вебхука (локальный тестовый эндпоинт).

## Наблюдаемость и логирование
- Fastify pino logger с requestId.
- Логирование шагов: навигация, извлечение, конверсия, вебхук.
- Метрики — отложить на Этап 2 (Prometheus/OpenTelemetry).

## Контейнеризация и запуск
- Dockerfile: установка playwright deps + `npx playwright install --with-deps chromium` при сборке.
- docker-compose: сервис API; прокси/серверы не требуются на Этапе 1.
- Скрипты pnpm: `start:dev`, `start:prod`, `test`, `test:e2e`.

## Безопасность и ограничения
- Валидация входных URL, запрет `file://` и локальных адресов (SSR F-защита) — базово на Этапе 1.
- Ограничение размера ответа, таймауты, ограничение параллелизма.
- Подпись вебхука — Этап 2.

## Риски и допущения
- Анти-бот механизмы сайтов могут блокировать headless браузер; в Этапе 1 минимальные меры (рандомная задержка, UA). Дальше — прокси, эмуляция ввода.
- Извлечение может давать неполные данные — предусмотрены `overrideSelectors`.

## Критерии готовности (DoD) Этап 1
- Эндпоинт `/v1/parse/page` возвращает корректный JSON и Markdown body на 3–5 реальных сайтах.
- Эндпоинт `/v1/parse/batch` обрабатывает 3+ URL с задержкой и отправляет вебхук с агрегированными результатами.
- Тесты: unit + e2e (успешный проход в CI).
- Docker-образ собирается и запускается локально.
- README обновлён разделом "Как запустить" и кратким описанием API, `config.yaml` и `env.production.example` соответствуют.

## Что дальше (Этап 2 — предварительно)
- Перенос очереди на Redis, устойчивость к рестартам.
- Сигнатуры вебхуков, ретраи вебхуков.
- Метрики/трейсинг, лимиты доменов, прокси-менеджмент.
