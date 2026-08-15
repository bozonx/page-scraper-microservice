# syntax=docker/dockerfile:1
ARG NODE_MAJOR=24

FROM node:${NODE_MAJOR}-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ENV PLAYWRIGHT_BROWSERS_PATH=/playwright
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY public ./public
RUN pnpm build \
  && pnpm exec playwright install chromium \
  && pnpm prune --prod

FROM node:${NODE_MAJOR}-bookworm-slim AS runtime
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
  LISTEN_HOST=0.0.0.0 \
  LISTEN_PORT=8080 \
  LOG_LEVEL=warn \
  TZ=UTC \
  SERVICE_VERSION=${APP_VERSION} \
  PLAYWRIGHT_BROWSERS_PATH=/playwright
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /playwright /playwright
COPY --chown=node:node package.json ./
RUN ./node_modules/.bin/playwright install-deps chromium \
  && apt-get install -y --no-install-recommends fonts-noto fonts-noto-color-emoji fonts-liberation tzdata \
  && rm -rf /var/lib/apt/lists/*
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const b=(process.env.BASE_PATH||'').replace(/^\/+|\/+$/g,'');const p='/'+(b?b+'/':'')+'api/v1/health';require('http').get('http://127.0.0.1:'+(process.env.LISTEN_PORT||8080)+p,r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["dist/main.js"]
