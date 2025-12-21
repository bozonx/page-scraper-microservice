ARG NODE_MAJOR=22
FROM node:${NODE_MAJOR}-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/playwright
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
  tini \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --prefer-offline || pnpm install --prod --prefer-offline
RUN pnpm dlx playwright install --with-deps chromium firefox

COPY dist ./dist

EXPOSE 8080
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/main.js"]
