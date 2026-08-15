# Agent Rules (alwaysApply)

> The section "Common rules" below is identical in every service of this fleet. Do not edit it in a
> single repository — change it in `ivank-microservice-boilerplate` and roll it out everywhere.
> Service-specific rules go in the last section only.

## Common rules

- Microservice with a REST API.
- Node.js version: see `.nvmrc`. It must agree with `package.json#engines.node`.
- Package manager: `pnpm`, version pinned in `package.json#packageManager`.
- The fleet-wide standard for tooling, Docker, configuration and dependencies is
  `docs/standards.md` in `ivank-microservice-boilerplate`. Follow it; if a change conflicts with it,
  change the standard first.

### Layout

- Source: `src/`, with `common/`, `config/`, `modules/`.
- Unit tests: `test/unit/`, setup in `test/setup/unit.setup.ts`.
- E2E tests: `test/e2e/`, setup in `test/setup/e2e.setup.ts`.
- Guides: `docs/`. Development stage notes: `dev_docs/`.
- Docker: `docker/Dockerfile` and `docker/docker-compose.yml`.

### Practices

- Environment variables: `.env.example` is the source of truth. There is exactly one other env
  file, `.env`, and it is git-ignored and for local development only.
- Service name and version come from `src/config/service-info.ts`, never from importing
  `package.json` at runtime.
- Run `pnpm check` before declaring work finished — it is what CI runs.
- Dependency ranges use caret (`^`). Never pin an exact version in the manifest.
- Update `docs/CHANGELOG.md` for significant changes.
- README, all documentation, JSDoc, log messages and user-facing strings are written in English.
- Do not leave transitional shims, deprecated aliases or compatibility fallbacks behind. When
  something is renamed or replaced, remove the old form in the same change.

## Service specifics

- Stack: TypeScript, NestJS, Fastify, Playwright, Pino, Docker.
- The runtime image includes Chromium and fonts and must remain usable by the non-root `node` user.
- Compose keeps `shm_size` for Chromium stability.
- Entry point: `src/main.ts`.
