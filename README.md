# Cypress-MindBody

Cypress E2E tests for [Minbody](https://github.com/TopsProductsPaul/Better-MindBody), in its own
repo — mirroring the `Cypress3.0` / `Helper3.0` split. Every UI feature added to Minbody gets a
spec here.

## Prerequisites

- Minbody's AppHost running locally (`cd Better-MindBody/src/Minbody.AppHost && dotnet run`) —
  Docker must be up first
- Node.js

## Run

```bash
npm install
npm run cypress:open:local   # interactive
npm run cypress:run:local    # headless
```

`local` points at Minbody's fixed local ports (`config/config.json`):
Web `55001`, Admin `55101`, API `55201` — pinned in `Minbody.AppHost/AppHost.cs` specifically so
this repo has a stable URL to test against.

## Conventions

- Selectors: `[data-cy="..."]` — never CSS classes or text content, both change with styling.
- `cy.loginAdmin('owner' | 'staff')` drives the real login form (no token-injection shortcut yet
  — there's only one login flow so far, so exercising it for real is more honest and no slower).
- Specs live under `cypress/e2e/<app>/<positive|negative>/`.
