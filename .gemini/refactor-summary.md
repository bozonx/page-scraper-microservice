# Рефакторинг: Плоская структура fingerprint

## Выполненные изменения

### 1. DTO (Data Transfer Objects)
**Файл:** `/src/modules/scraper/dto/scraper-request.dto.ts`
- ✅ Удален класс `FingerprintGeneratorConfigDto`
- ✅ Поля `browsers`, `operatingSystems`, `devices`, `locales` перенесены напрямую в `FingerprintConfigDto`

**Было:**
```typescript
export class FingerprintConfigDto {
  generate?: boolean
  userAgent?: string
  locale?: string
  timezoneId?: string
  rotateOnAntiBot?: boolean
  generator?: FingerprintGeneratorConfigDto // вложенный объект
}
```

**Стало:**
```typescript
export class FingerprintConfigDto {
  generate?: boolean
  userAgent?: string
  locale?: string
  timezoneId?: string
  rotateOnAntiBot?: boolean
  browsers?: string[]
  operatingSystems?: string[]
  devices?: string[]
  locales?: string[]
}
```

### 2. Сервис Fingerprint
**Файл:** `/src/modules/scraper/services/fingerprint.service.ts`
- ✅ Обновлены обращения к полям: `fingerprintConfig.generator.browsers` → `fingerprintConfig.browsers`
- ✅ Аналогично для `operatingSystems`, `devices`, `locales`

### 3. Unit тесты
**Файл:** `/test/unit/fingerprint.service.spec.ts`
- ✅ Обновлены все тестовые данные для использования плоской структуры
- ✅ Переименован тест: `'should respect generator options'` → `'should respect browsers option'`
- ✅ Все тесты успешно проходят (73 passed)

### 4. N8N нода
**Файл:** `/n8n-nodes-bozonx-page-scraper-microservice/nodes/PageScraper/PageScraper.node.ts`

#### Добавлены новые поля в UI:
- ✅ `Fingerprint: Operating Systems` - список ОС для симуляции
- ✅ `Fingerprint: Devices` - типы устройств (desktop, mobile)
- ✅ `Fingerprint: Locales` - локали для симуляции

#### Обновлена логика построения объекта fingerprint:
**Было:**
```typescript
if (additionalOptions.fingerprintBrowsers) {
  fingerprint.generator = {
    browsers: additionalOptions.fingerprintBrowsers.split(',').map(b => b.trim())
  }
}
```

**Стало:**
```typescript
if (additionalOptions.fingerprintBrowsers) {
  fingerprint.browsers = additionalOptions.fingerprintBrowsers.split(',').map(b => b.trim())
}
if (additionalOptions.fingerprintOperatingSystems) {
  fingerprint.operatingSystems = additionalOptions.fingerprintOperatingSystems.split(',').map(os => os.trim())
}
if (additionalOptions.fingerprintDevices) {
  fingerprint.devices = additionalOptions.fingerprintDevices.split(',').map(d => d.trim())
}
if (additionalOptions.fingerprintLocales) {
  fingerprint.locales = additionalOptions.fingerprintLocales.split(',').map(l => l.trim())
}
```

### 5. Документация
**Файл:** `/README.md`
- ✅ Обновлены все примеры API для `/page` endpoint
- ✅ Обновлены все примеры API для `/html` endpoint
- ✅ Обновлены все примеры API для `/batch` endpoint
- ✅ Обновлены примеры использования (Examples 2, 3)
- ✅ Обновлено описание в разделе "Anti-Bot Protection"

**Пример изменения:**
```json
// Было:
{
  "fingerprint": {
    "generate": true,
    "generator": {
      "browsers": ["chrome"],
      "operatingSystems": ["windows", "macos"],
      "devices": ["desktop"],
      "locales": ["en-US"]
    }
  }
}

// Стало:
{
  "fingerprint": {
    "generate": true,
    "browsers": ["chrome"],
    "operatingSystems": ["windows", "macos"],
    "devices": ["desktop"],
    "locales": ["en-US"]
  }
}
```

## Результаты тестирования

### ✅ Unit тесты
```
Test Suites: 10 passed, 10 total
Tests:       73 passed, 73 total
```

### ✅ Компиляция основного проекта
```
pnpm build - успешно
```

### ✅ Компиляция N8N ноды
```
pnpm build - успешно
✓ Build successful
```

## Обратная совместимость

⚠️ **BREAKING CHANGE**: Это изменение ломает обратную совместимость API.

Клиенты, использующие старую структуру с вложенным `generator`, должны обновить свои запросы:

**Миграция для клиентов:**
```diff
{
  "fingerprint": {
    "generate": true,
-   "generator": {
-     "browsers": ["chrome"]
-   }
+   "browsers": ["chrome"]
  }
}
```

## Преимущества новой структуры

1. **Упрощение API** - меньше уровней вложенности
2. **Улучшенная читаемость** - все параметры fingerprint на одном уровне
3. **Консистентность** - все поля fingerprint находятся в одном объекте
4. **Удобство использования** - проще работать с JSON структурой

## Файлы, затронутые изменениями

1. `/src/modules/scraper/dto/scraper-request.dto.ts`
2. `/src/modules/scraper/services/fingerprint.service.ts`
3. `/test/unit/fingerprint.service.spec.ts`
4. `/n8n-nodes-bozonx-page-scraper-microservice/nodes/PageScraper/PageScraper.node.ts`
5. `/README.md`
