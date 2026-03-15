# Contributing

## Prerequisites

- [Node.js](https://nodejs.org/) v22+ (see `.nvmrc`)

```bash
nvm use
npm install
```

## Development

```bash
npm run dev        # Start dev server at http://localhost:5173/cali-vibe/
npm run build      # TypeScript check + production build
npm run preview    # Preview production build locally
```

## Linting

```bash
npm run lint
```

## Unit Tests

Unit tests use [Vitest](https://vitest.dev/) with jsdom and [Testing Library](https://testing-library.com/).

```bash
npm test              # Single run
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Test files live alongside source code in `src/**/__tests__/` directories, following the `*.test.{ts,tsx}` pattern.

## E2E Tests

E2E visual snapshot tests use [Playwright](https://playwright.dev/) with Chromium.

```bash
npm run test:e2e          # Run e2e tests (auto-starts dev server)
npm run test:e2e:update   # Update snapshot baselines
```

- Snapshots are stored in `e2e/visual-snapshots.spec.ts-snapshots/`.
- Tests run sequentially (1 worker) because WebGL rendering requires software rasterization.
- The dev server starts automatically when running e2e tests.

### Updating Snapshots

When you change the UI, snapshot tests will fail because the screenshots no longer match the baselines. To update:

```bash
npm run test:e2e:update
```

Review the updated images in `e2e/visual-snapshots.spec.ts-snapshots/` to confirm they look correct, then commit them.

### Writing Snapshot Tests

The app state is driven by URL parameters (e.g., `?relief=0&counties=1&cmode=colored`), making it easy to test specific views without UI interaction. See `e2e/visual-snapshots.spec.ts` for examples.

For tests that need localStorage data (e.g., favorites), use `page.addInitScript()` to seed data before the page loads.

## CI / GitHub Actions

The deploy workflow (`.github/workflows/deploy.yml`) runs on every push to `main`:

1. **test** -- lint + unit tests with coverage
2. **test-e2e** -- Playwright visual snapshot tests
3. **build** -- TypeScript check + Vite production build
4. **deploy** -- Deploy to GitHub Pages

Both `test` and `test-e2e` must pass before `build` and `deploy` run.

### Skipping E2E in CI

If e2e tests are failing and you need to deploy urgently, add `[skip-e2e]` to your commit message:

```bash
git commit -m "fix: urgent hotfix [skip-e2e]"
```

This skips the e2e job while still running unit tests and lint. Use sparingly -- e2e tests exist to catch visual regressions.
