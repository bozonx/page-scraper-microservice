# Обновление: Расширенные опции fingerprint

## Выполненные изменения

### 1. Обновлены значения по умолчанию

#### Browsers
- **Было:** `["chrome"]`
- **Стало:** `["chrome", "firefox"]`

#### Operating Systems
- **Было:** `["windows", "macos"]`
- **Стало:** `["windows", "macos", "linux"]`

#### Devices
- **Было:** `["desktop"]`
- **Стало:** `["desktop", "mobile"]`

### 2. Документация (README.md)

✅ Добавлен новый раздел "Available Fingerprint Options" с полным списком:

**Browsers:**
- `chrome` - Google Chrome browser
- `firefox` - Mozilla Firefox browser

**Operating Systems:**
- `windows` - Microsoft Windows
- `macos` - Apple macOS
- `linux` - Linux distributions
- `android` - Android mobile OS
- `ios` - Apple iOS

**Devices:**
- `desktop` - Desktop computers
- `mobile` - Mobile devices (phones and tablets)

**Locales:**
- Any valid locale string (e.g., `en-US`, `ru-RU`, `de-DE`, `fr-FR`, `es-ES`, `ja-JP`, `zh-CN`)

✅ Обновлены все примеры API с расширенными опциями

### 3. DTO (src/modules/scraper/dto/scraper-request.dto.ts)

✅ Добавлены комментарии с указанием всех доступных опций:

```typescript
/**
 * List of browsers to simulate (e.g., ['chrome', 'firefox'])
 * Available options: chrome, firefox
 */
public browsers?: string[]

/**
 * List of operating systems to simulate (e.g., ['windows', 'macos', 'linux'])
 * Available options: windows, macos, linux, android, ios
 */
public operatingSystems?: string[]

/**
 * List of device types to simulate (e.g., ['desktop', 'mobile'])
 * Available options: desktop, mobile
 */
public devices?: string[]
```

### 4. N8N нода

✅ Обновлены значения по умолчанию:
- `fingerprintBrowsers`: `'chrome,firefox'`
- `fingerprintOperatingSystems`: `'windows,macos,linux'`
- `fingerprintDevices`: `'desktop,mobile'`

✅ Обновлены описания полей с указанием всех доступных опций

### 5. Тесты (test/unit/fingerprint.service.spec.ts)

✅ Добавлено 7 новых тестов:
- `should support firefox browser`
- `should support multiple browsers`
- `should support linux operating system`
- `should support macos operating system`
- `should support multiple operating systems`
- `should support desktop device`
- `should support multiple devices`

**Результаты тестирования:**
```
Test Suites: 10 passed, 10 total
Tests:       80 passed, 80 total (было 73)
```

## Примеры использования

### Пример 1: Множественные браузеры и ОС
```json
{
  "fingerprint": {
    "browsers": ["chrome", "firefox"],
    "operatingSystems": ["windows", "macos", "linux"],
    "devices": ["desktop", "mobile"]
  }
}
```

### Пример 2: Мобильные устройства с Android
```json
{
  "fingerprint": {
    "browsers": ["chrome"],
    "operatingSystems": ["android"],
    "devices": ["mobile"],
    "locales": ["en-US", "ru-RU"]
  }
}
```

### Пример 3: iOS устройства
```json
{
  "fingerprint": {
    "browsers": ["firefox"],
    "operatingSystems": ["ios"],
    "devices": ["mobile"],
    "locale": "en-US"
  }
}
```

## Измененные файлы

1. ✅ `/README.md` - добавлен раздел с опциями, обновлены примеры
2. ✅ `/src/modules/scraper/dto/scraper-request.dto.ts` - добавлены комментарии
3. ✅ `/n8n-nodes-bozonx-page-scraper-microservice/nodes/PageScraper/PageScraper.node.ts` - обновлены defaults
4. ✅ `/test/unit/fingerprint.service.spec.ts` - добавлены новые тесты

## Результаты

✅ **Unit тесты:** 80/80 passed (+7 новых тестов)
✅ **Компиляция основного проекта:** успешно
✅ **Компиляция N8N ноды:** успешно

## Преимущества

1. **Больше разнообразия** - поддержка Firefox, Linux, мобильных устройств
2. **Лучшая документация** - полный список доступных опций
3. **Улучшенное тестирование** - проверка всех комбинаций
4. **Реалистичные defaults** - более разнообразные значения по умолчанию для лучшей защиты от детекции
