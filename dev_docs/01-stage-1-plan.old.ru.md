# Этап 1: План реализации микросервиса Page Scraper

Микросервис для распознавания и извлечения статей по URL с использованием NestJS (Fastify), Crawlee + Playwright и @extractus/article-extractor. Выход: JSON c title, description, date, author, body (Markdown).

## Цели этапа
- Реализовать минимально жизнеспособный API для одиночного запроса распознавания страницы.
- Добавить поддержку конфигурируемых источников через `config.yaml` для парсинга списков страниц (news_page) и отдельных статей (article_page).
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
  - `SourcesService` — работа с конфигурируемыми источниками из `config.yaml` (парсинг списков страниц и отдельных статей по селекторам).
- Модуль Batch (минимум)
  - `BatchController` — `/v1/batch`.
  - `BatchService` — постановка задач в in-memory очередь, планирование задержек, агрегация результатов, вызов вебхука.
- Конфигурация
  - `config.yaml` — источники для парсинга (news_page, article_page) с селекторами, локалями, fingerprint и другими параметрами.
  - Загрузка через NestJS ConfigModule под namespace 'sources'.
- Общие компоненты
  - Валидация DTO (class-validator), трансформация (class-transformer).
  - Логирование (pino via FastifyLogger), интерсепторы ошибок.

## Потоки данных
- Одиночная страница (ad-hoc): HTTP POST -> Validation -> ParsingService -> Crawlee(Playwright) -> загрузка страницы -> article-extractor -> HTML->MD -> ответ 200 JSON.
- Конфигурируемый источник: HTTP POST (sourceId) -> SourcesService -> чтение config.yaml -> парсинг по селекторам (news_page/article_page) -> массив результатов -> ответ 200 JSON.
- Пакет: HTTP POST -> Validation -> BatchService -> постановка N задач с задержками -> выполнение по очереди -> накопление результатов -> POST вебхук -> ответ 202 (jobId).

## Контракты API (черновик)

### POST /v1/sources/:sourceId
Назначение: запустить парсинг конфигурируемого источника по его ID из `config.yaml`.

Request: без тела (опционально можно передать параметры переопределения).

Response 200 (JSON):
```json
{
  "sourceId": "example_news",
  "type": "news_page",
  "items": [
    {
      "title": "News title 1",
      "description": "News description",
      "date": "2024-11-12T10:00:00.000Z",
      "link": "https://example.com/news/1",
      "tags": ["politics", "economy"]
    },
    {
      "title": "News title 2",
      "description": null,
      "date": "2024-11-11T15:30:00.000Z",
      "link": "https://example.com/news/2",
      "tags": []
    }
  ],
  "meta": {
    "total": 2,
    "limit": 100,
    "scrapedAt": "2024-11-12T12:00:00.000Z"
  }
}
```

Коды ошибок: 400 (валидация), 404 (источник не найден), 422 (не удалось распарсить), 504/502 (таймаут), 500 (непредвиденное).

### POST /v1/page
Назначение: распознать одну произвольную страницу (ad-hoc режим без конфигурации).

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
- Конфигурируемые источники (SourcesService)
  - Загрузка `config.yaml` через NestJS ConfigModule (namespace: `sources`).
  - Поддержка двух типов источников:
    - `news_page` — парсинг списка новостей по селекторам (itemSelector, titleSelector, descriptionSelector, dateSelector, linkSelector, tagsSelector).
    - `article_page` — парсинг отдельной статьи (titleSelector, descriptionSelector, authorSelector, dateSelector, contentSelector).
  - Режимы парсинга: `cheerio` (без браузера, быстрее) и `playwright` (с браузером, для динамического контента).
  - Поддержка локалей, часовых поясов, fingerprint-генерации, блокировки трекеров и тяжелых ресурсов.
  - Политики обработки отсутствующих дат: skip, useTaskStart, error, empty.
- Извлечение статьи (ad-hoc режим)
  - `@extractus/article-extractor` -> HTML/метаданные.
  - HTML → Markdown через `turndown` (минимальная конфигурация, базовые правила).
  - Чистка текста: тримминг, удаление лишних пробелов, опциональная нормализация.
- Ошибки и ретраи
  - 1–2 ретрая при сетевых/временных сбоях с экспоненциальной задержкой.
  - Явные коды и понятные сообщения.

## Конфигурация и ENV
Источник правды — `env.production.example` и `config.yaml`.

### Переменные окружения
- `HTTP_PORT` (по умолчанию 3000)
- `LOG_LEVEL` (info|debug)
- `CONFIG_PATH` (путь к config.yaml, по умолчанию ./config.yaml)
- `PLAYWRIGHT_HEADLESS=true`
- `PLAYWRIGHT_TIMEOUT_MS=30000`
- `SCRAPER_DEFAULT_UA=auto`
- `BATCH_MIN_DELAY_MS=1500`
- `BATCH_MAX_DELAY_MS=4000`
- `BATCH_CONCURRENCY=1`
- `WEBHOOK_TIMEOUT_MS=10000`

### Структура config.yaml
Файл содержит конфигурацию источников для парсинга. Поддерживается два формата:
1. Плоский (источники на верхнем уровне)
2. С оберткой `sources:` (источники внутри ключа sources)

Пример конфигурации источника типа `news_page`:
```yaml
example_news:
  # Тип источника: news_page — парсинг HTML-страницы со списком новостей
  type: news_page
  # Режим парсинга: cheerio (без браузера) | playwright (с браузером)
  mode: cheerio
  # URL страницы с новостями
  url: https://example.com/news
  # CSS-селектор карточки новости (итерация по найденным элементам)
  # считается родительским для остальных селекторов
  itemSelector: article.card
  # CSS-селектор заголовка новости
  titleSelector: h2.card__title
  # Атрибут для извлечения заголовка (опционально)
  titleAttr: title
  # CSS-селектор описания новости
  descriptionSelector: .card__desc
  # Атрибут для извлечения описания (опционально)
  descriptionAttr: data-desc
  # CSS-селектор даты новости
  dateSelector: time
  # Атрибут для извлечения даты (опционально)
  dateAttr: datetime
  # CSS-селектор ссылки на новость
  linkSelector: a.card__link
  # Атрибут с URL ссылки
  linkAttr: href
  # CSS-селектор тегов (опционально)
  tagsSelector: .card__tag
  # Атрибут с тегом/меткой (опционально)
  tagsAttr: data-tag
  # Локаль, используемая краулером:
  #  - HTTP: используется для Accept-Language только при наличии fingerprint и fingerprint.locale = 'source'
  #  - Даты: используется по умолчанию для парсинга дат, если dateLocale не указан
  # Примеры: "en-US", "en-GB", "ru"
  locale: ru
  # Локаль для парсинга дат (опционально). Если не указана, используется locale выше.
  dateLocale: ru
  # Часовой пояс для браузера и парсинга дат (IANA). Пример: Europe/Moscow
  timezoneId: Europe/Moscow
  # Переопределение часового пояса специально для парсинга дат (IANA). Если не указан, используется timezoneId.
  # dateTimezoneId: Europe/Moscow
  # Максимальное количество обрабатываемых карточек новостей
  limit: 100
  # Переопределения только для этого источника
  # Таймаут обработки одной задачи, секунды
  taskTimeoutSecs: 45
  # Политика по умолчанию, когда у элемента нет даты (может быть переопределена для задачи):
  #  - skip | useTaskStart | error | empty
  #  empty — сохранить элемент без поля даты
  onMissingDate: empty
  # Playwright: блокировать трекеры/рекламу для этого источника
  blockTrackers: true
  # Playwright: блокировать тяжелые ресурсы (изображения, медиа, шрифты) для этого источника
  blockHeavyResources: true
  fingerprint:
    # generate — включить генерацию fingerprint для этого источника; ограничения в generator сужают случайность
    generate: true
    # userAgent — 'auto' берет UA из сгенерированного fingerprint; строка переопределяет
    userAgent: auto
    # locale — 'auto' сохраняет заголовок генератора; 'source' использует source.locale; 'off' отключает; или явная строка локали
    # locale: source
    # timezoneId — 'auto' использует env TZ; 'source' использует source.timezoneId/dateTimezoneId; 'off' отключает; или явный IANA
    # timezoneId: source
    # rotateOnAntiBot — ротация fingerprint только после повтора из-за анти-бота
    rotateOnAntiBot: true
    # generator — ограничения для генерации по источнику (применяются при generate=true)
    generator:
      browsers: ["chrome"]
```

Пример источника типа `article_page`:
```yaml
example_article:
  # Тип источника: article_page — парсинг отдельной статьи
  type: article_page
  mode: playwright
  url: https://example.com/article/123
  # Селекторы для извлечения данных статьи
  titleSelector: h1.article__title
  descriptionSelector: .article__lead
  authorSelector: .article__author
  dateSelector: time.article__date
  dateAttr: datetime
  contentSelector: .article__body
  locale: en-US
  timezoneId: UTC
  taskTimeoutSecs: 30
  fingerprint:
    generate: false
```

Конфигурация загружается через NestJS ConfigModule под namespace `sources`.

## Тестирование
- Unit (`test/unit`):
  - `ParsingService` (успешный разбор, ошибки таймаута, обработка селекторов).
  - `SourcesService` (загрузка конфигурации, парсинг по селекторам для news_page и article_page).
  - `BatchService` (расписание задержек, агрегация результатов, вызов вебхука — моки HTTP).
- E2E (`test/e2e`):
  - `/health` (уже есть).
  - `/v1/sources/:sourceId` — парсинг конфигурируемого источника (позитивные/негативные кейсы).
  - `/v1/page` — ad-hoc парсинг страницы (позитивный/негативный кейсы).
  - `/v1/batch` — пакетная обработка с эмуляцией вебхука (локальный тестовый эндпоинт).

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
- Эндпоинт `/v1/sources/:sourceId` корректно парсит источники типа `news_page` и `article_page` из `config.yaml`.
- Эндпоинт `/v1/page` возвращает корректный JSON и Markdown body на 3–5 реальных сайтах (ad-hoc режим).
- Эндпоинт `/v1/batch` обрабатывает 3+ URL с задержкой и отправляет вебхук с агрегированными результатами.
- Конфигурация `config.yaml` загружается через NestJS ConfigModule, поддерживаются оба формата (плоский и с оберткой sources).
- Тесты: unit + e2e (успешный проход в CI).
- Docker-образ собирается и запускается локально.
- README обновлён разделом "Как запустить" и кратким описанием API, `config.yaml.example` и `env.production.example` соответствуют.

## Что дальше (Этап 2 — предварительно)
- Перенос очереди на Redis, устойчивость к рестартам.
- Сигнатуры вебхуков, ретраи вебхуков.
- Метрики/трейсинг, лимиты доменов, прокси-менеджмент.
