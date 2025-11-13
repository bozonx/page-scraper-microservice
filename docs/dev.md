# Руководство по разработке (dev)

## Требования

- Node.js 22+
- pnpm 10+

## Быстрый старт (dev)

```bash
# 1) Установка зависимостей
pnpm install

# 2) Окружение (dev)
cp env.development.example .env.development

# 3) Запуск в режиме разработки (watch)
pnpm start:dev
```

- URL по умолчанию (dev): `http://localhost:3000/api/v1`

## Тесты

Проекты Jest разделены на `unit` и `e2e`.

```bash
# Все тесты
pnpm test

# Unit-тесты
pnpm test:unit

# E2E-тесты
pnpm test:e2e

# Непрерывный прогон
pnpm test:watch

# Покрытие
pnpm test:cov

# Отладка
pnpm test:unit:debug
pnpm test:e2e:debug
```

## Качество кода

```bash
# Линт
pnpm lint

# Форматирование
pnpm format
```

## Полезно знать

- Включена глобальная `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).
- В dev используется `pino-pretty` c более подробными логами.
- В prod игнорируется автологирование `/health`; в dev — логируется.
- Чувствительные заголовки редактируются в логах (`authorization`, `x-api-key`).
- Аликсы путей TypeScript/Jest: `@/*`, `@common/*`, `@modules/*`, `@config/*`, `@test/*`.
