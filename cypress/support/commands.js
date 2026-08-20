/**
 * Visit a path on the Admin (ops) app.
 */
Cypress.Commands.add('visitAdmin', (path = '/') => {
  cy.visit(`${Cypress.env('adminBaseUrl')}${path}`);
});

/**
 * Visit a path on the public Web app.
 */
Cypress.Commands.add('visitWeb', (path = '/') => {
  cy.visit(`${Cypress.env('baseUrl') || Cypress.config('baseUrl')}${path}`);
});

/**
 * Log in to the Admin app through the real login form (not a token shortcut — this is the
 * only UI we have so far, so exercising it directly is the more honest test).
 *
 * localStorage persists across tests/specs in the same browser (Cypress's test isolation
 * clears cookies and navigation state, not localStorage) — so a leftover JWT from an earlier
 * login makes the Login page redirect before the form ever renders. Clear it first so this
 * command is idempotent regardless of prior auth state.
 */
Cypress.Commands.add('loginAdmin', (role = 'owner') => {
  const creds = Cypress.env('loginCredentials')[role];
  if (!creds) {
    throw new Error(`Unknown demo role "${role}". Known: ${Object.keys(Cypress.env('loginCredentials')).join(', ')}`);
  }

  cy.visitAdmin('/login');
  cy.window().then((win) => win.localStorage.removeItem('minbody.auth.token'));
  cy.visitAdmin('/login');
  cy.get('[data-cy="login-email-input"]').clear().type(creds.email);
  cy.get('[data-cy="login-password-input"]').clear().type(creds.password);
  cy.get('[data-cy="login-submit"]').click();

  // Wait for the post-login redirect to actually land before returning control to the spec —
  // otherwise a caller that navigates away immediately can race the async login (JWT write +
  // client-side NavigateTo) and land on a half-authenticated page.
  cy.location('pathname').should('not.eq', '/login');
});
