# Cypress best practices (this repo)

Adapted from `Cypress3.0` (Helper3.0's E2E suite) — the parts that are genuinely about writing
good Cypress, stripped of everything specific to that codebase's stack (MudBlazor internals),
scale (hundreds of specs, coverage-drift tooling, Jira ticket extraction), and domain (tax filing,
EFW2). Revisit and expand this as Minbody's suite grows past a handful of specs — don't front-load
process that doesn't have enough surface area to pay for itself yet.

Start with Cypress's own guide:
[Best practices](https://docs.cypress.io/app/core-concepts/best-practices). Everything below is
this repo's take on it, not a replacement for it.

## Specs

- **Independent** — every spec must pass on its own (e.g. run with `.only`). Don't rely on state
  left behind by another spec or an earlier test in the same file.
- **Cleanup in `beforeEach`, not `afterEach`** — `afterEach` doesn't run reliably when a test
  fails, so state meant to reset between tests belongs at the start of the next one, not the end
  of the last.
- **No arbitrary `cy.wait(ms)`.** Prefer an assertion that retries (`cy.get(...).should(...)`) or
  `cy.wait('@alias')` for a specific network call. A fixed wait is either too short (flaky) or too
  long (slow) — it's never actually correct.
- **Never assign `cy.get()` to a variable.** Commands are async and re-run on retry;
  `const x = cy.get(...)` captures a stale reference. Use `.then()` or `.as()`/aliases instead.
- **After navigation or a form submit**, wait for the page to actually be ready before asserting:
  `cy.document().its('readyState').should('eq', 'complete')`.
- **Prefer explicit chains over `forEach` loops** for repeated checks. A loop that enqueues many
  commands from synchronous iteration hides failures in the command log and makes retries hard to
  read. Repeat the `cy.get()` block explicitly in the `it()` body instead.

## Selectors

- **`[data-cy="..."]` only** — never a CSS class or text content selector; both change with
  styling/copy and neither is meant to be stable. See the root `README.md` for the tagging
  convention (interactive controls, state content, nav destinations — not every heading).
- **Never `cy.get('body')`** or scan `$body` for text/elements to decide whether something exists.
  Hidden/portaled content can make body-level checks flaky or falsely positive. Scope to a visible
  container instead.
- **Scope errors/validation to their container**, not document-wide — `[data-cy="login-error"]`,
  not a page-wide text search.

## Network calls from tests

- `cy.request({ url, method, body, failOnStatusCode: false })` with explicit assertions on
  `status` and body shape — don't just check the call didn't throw.
- `cy.intercept` + an alias for anything the UI itself triggers, then `cy.wait('@alias')` rather
  than guessing how long a request takes.

## Assert real values, not just presence

The single highest-value habit from Cypress3.0's own retrospective (measured across 162 specs:
structural assertions outnumbered value assertions almost 6 to 1, and a checkout confirmation
screen asserted the words "Amount charged" but never the amount).

**If a value is relevant to what the test proves, assert the value** — not that the element
exists, is visible, or "looks like" the right shape.

```js
// Not enough — every wrong role passes:
cy.get('[data-cy="dashboard-role-badge"]').should('be.visible');

// Confirmed — the role shown is the role we logged in as:
cy.get('[data-cy="dashboard-role-badge"]').should('have.text', 'Owner');
```

A regex like `/role/i` or a bare `.should('exist')` passes for any wrong value just as easily as
the right one. `contain.text('1')` passes on `11` too — assert the exact value when the test cares
about it, not a loose match.

## Test data

**UI first when creating the data *is* the behaviour under test, or the setup is short. Switch to
API seeding once prerequisite setup gets long or incidental. Database seeding is a last resort.**

Right now every Minbody spec uses UI-first setup (`cy.loginAdmin()` drives the real login form) —
there's exactly one flow, so there's nothing to seed around yet. When specs need data the login
flow doesn't produce (a second organization, a class schedule, a booking), prefer a reusable
scenario helper under `cypress/support/test-data/` over inline one-off setup in a spec — and only
reach for direct database seeding if the API genuinely can't produce the state.

**Treat any shared/hosted environment as dirty.** If Minbody ever gets a dev/staging environment
Cypress runs against, specs must not assume a clean database — use unique per-run data (a
timestamp suffix on emails/names) rather than static fixtures.

## Environment selection

Specs are environment-agnostic. `cypress.config.js` reads `environments[name]` from
`config/config.json` and sets `baseUrl` at startup — don't pass `--config baseUrl=...` by hand.

| Target | Script |
| --- | --- |
| Local (Minbody's fixed Aspire ports) | `npm run cypress:open:local` / `cypress:run:local` |

Add a row here (and an entry in `config/config.json`) when a second environment exists.
