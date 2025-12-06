## Agent Rules (alwaysApply)

- Microservice with REST API
- Stack: TypeScript, NestJS, Fastify, Docker, Playwright, Crawlee, Pino

### Structure and Practices

- Node.js: version 22
- Package manager: `pnpm`
- Tests:
  - Unit tests: `test/unit/`
  - E2E tests: `test/e2e/`
  - setup of unit tests: `test/setup/unit.setup.ts`
  - setup of e2e tests: `test/setup/e2e.setup.ts`
  - README, all the documentation, jsdoc, messages and strings have to be in English. But dev_docs in Russian
- Environment variables: `.env.production.example` is the source of truth for expected variables
