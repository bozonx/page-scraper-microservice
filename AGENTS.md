## Agent Rules (alwaysApply)

- Microservice with REST API
- Stack: TypeScript, NestJS, Fastify, Docker

### Structure and Practices

- Node.js: version 22
- Package manager: `pnpm`
- Imports: prefer path aliases
- Tests:
  - Unit tests: `test/unit/`
  - E2E tests: `test/e2e/`
  - setup of unit tests: `test/setup/unit.setup.ts`
  - setup of e2e tests: `test/setup/e2e.setup.ts`
- Documentation:
  - Guides: `docs/`
  - Development stage docs: `dev_docs/`
  - Update `docs/CHANGELOG.md` for significant changes
  - README, all the documentation, jsdoc, messages and strings have to be in English. But dev_docs in Russian
- Environment variables: `.env.production.example` is the source of truth for expected variables
- source of truth of microservice config is `config.yaml`, including source examples
