ARG NODE_MAJOR=22
FROM node:${NODE_MAJOR}-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV LISTEN_HOST=0.0.0.0
ENV LISTEN_PORT=8080
ENV TZ=UTC
ENV LOG_LEVEL=warn

# pnpm
RUN corepack enable

# System packages for realistic rendering and time zone
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    procps \
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-liberation \
    tzdata \
    wget \
 && rm -rf /var/lib/apt/lists/*

# Установка зависимостей приложения
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --prefer-offline || pnpm install --prod --prefer-offline

# Установка Playwright deps + Chromium (без devDeps в образе)
# Скрипт сам подтянет системные зависимости (apt) и браузер
RUN pnpm dlx playwright install --with-deps chromium

# Копия предсобранного приложения
COPY dist ./dist

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/v1/health || exit 1
CMD ["node", "dist/src/main.js"]
