# Deployment

Build with `pnpm docker:build` and start with `pnpm docker:up`. The multi-stage image installs the
lock-file Playwright version, Chromium and its system dependencies, then runs as `node`. Compose
provides `/dev/shm`, scratch tmpfs, init, graceful stop, log rotation and a 2 GiB memory limit.
