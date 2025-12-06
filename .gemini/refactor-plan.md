# План рефакторинга: Сделать структуру generator плоской

## Цель
Вынести поля `generator` (browsers, operatingSystems, devices, locales) на уровень `fingerprint`.

## Текущая структура
```json
{
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    "locale": "en-US",
    "timezoneId": "UTC",
    "rotateOnAntiBot": true,
    "generator": {
      "browsers": ["chrome"],
      "operatingSystems": ["windows", "macos"],
      "devices": ["desktop"],
      "locales": ["en-US"]
    }
  }
}
```

## Новая структура
```json
{
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    "locale": "en-US",
    "timezoneId": "UTC",
    "rotateOnAntiBot": true,
    "browsers": ["chrome"],
    "operatingSystems": ["windows", "macos"],
    "devices": ["desktop"],
    "locales": ["en-US"]
  }
}
```

## Файлы для изменения

### 1. DTO файлы
- [x] `/src/modules/scraper/dto/scraper-request.dto.ts`
  - Удалить класс `FingerprintGeneratorConfigDto`
  - Перенести поля в `FingerprintConfigDto`

### 2. Сервисы
- [x] `/src/modules/scraper/services/fingerprint.service.ts`
  - Обновить обращения к `fingerprintConfig.generator.*` на `fingerprintConfig.*`

### 3. Тесты
- [x] `/test/unit/fingerprint.service.spec.ts`
  - Обновить тестовые данные

### 4. N8N нода
- [x] `/n8n-nodes-bozonx-page-scraper-microservice/nodes/PageScraper/PageScraper.node.ts`
  - Обновить построение объекта fingerprint
  - Убрать вложенный объект `generator`

### 5. Документация
- [x] `/README.md`
  - Обновить примеры API
  - Обновить все примеры использования

## Порядок выполнения
1. Обновить DTO (scraper-request.dto.ts)
2. Обновить сервис (fingerprint.service.ts)
3. Обновить тесты (fingerprint.service.spec.ts)
4. Обновить N8N ноду (PageScraper.node.ts)
5. Обновить README.md
