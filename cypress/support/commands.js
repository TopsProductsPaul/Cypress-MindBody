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
 */
Cypress.Commands.add('loginAdmin', (role = 'owner') => {
  const creds = Cypress.env('loginCredentials')[role];
  if (!creds) {
    throw new Error(`Unknown demo role "${role}". Known: ${Object.keys(Cypress.env('loginCredentials')).join(', ')}`);
  }

  cy.visitAdmin('/login');
  cy.get('[data-cy="login-email-input"]').clear().type(creds.email);
  cy.get('[data-cy="login-password-input"]').clear().type(creds.password);
  cy.get('[data-cy="login-submit"]').click();
});
