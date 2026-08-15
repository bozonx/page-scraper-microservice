# Development

Use Node.js from `.nvmrc`, run `pnpm install`, copy `.env.example` to `.env`, and start with
`pnpm dev`. Run `pnpm check` and the relevant e2e suites before submitting changes. Tests that need
a real browser use the Playwright availability helper and may be skipped when Chromium is absent.
