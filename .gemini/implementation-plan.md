# План реализации: Перенос blockTrackers и blockHeavyResources в fingerprint

## Цель
Перенести параметры `blockTrackers` и `blockHeavyResources` из корня запроса в объект `fingerprint` во всем проекте.

## Затронутые файлы

### 1. DTOs (Data Transfer Objects)
- `src/modules/scraper/dto/scraper-request.dto.ts` - ScraperRequestDto и FingerprintConfigDto
- `src/modules/scraper/dto/html-request.dto.ts` - HtmlRequestDto
- `src/modules/scraper/dto/batch.dto.ts` - BatchCommonSettingsDto

### 2. Сервисы
- `src/modules/scraper/services/scraper.service.ts` - обновить логику чтения параметров

### 3. Тесты
- `test/unit/html.service.spec.ts`
- `test/e2e/scraper-mk-ru-playwright.e2e-spec.ts`
- `test/e2e/scraper-batch.e2e-spec.ts`
- `test/e2e/scraper-html.e2e-spec.ts`

### 4. N8N нода
- `n8n-nodes-bozonx-page-scraper-microservice/nodes/PageScraper/PageScraper.node.ts`

### 5. Документация
- `README.md` - обновить примеры API и описания

## Изменения

### Структура до изменений:
```json
{
  "url": "...",
  "blockTrackers": true,
  "blockHeavyResources": false,
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    ...
  }
}
```

### Структура после изменений:
```json
{
  "url": "...",
  "fingerprint": {
    "generate": true,
    "userAgent": "auto",
    "blockTrackers": true,
    "blockHeavyResources": false,
    ...
  }
}
```

## Последовательность действий

1. **Обновить FingerprintConfigDto** - добавить поля blockTrackers и blockHeavyResources
2. **Обновить ScraperRequestDto** - удалить поля blockTrackers и blockHeavyResources
3. **Обновить HtmlRequestDto** - удалить поля blockTrackers и blockHeavyResources
4. **Обновить BatchCommonSettingsDto** - удалить поля blockTrackers и blockHeavyResources
5. **Обновить scraper.service.ts** - изменить путь доступа к параметрам
6. **Обновить все тесты** - изменить структуру тестовых данных
7. **Обновить N8N ноду** - переместить параметры в секцию fingerprint
8. **Обновить README.md** - обновить все примеры и описания API
