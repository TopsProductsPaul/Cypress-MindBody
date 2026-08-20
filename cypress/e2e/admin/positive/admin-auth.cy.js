describe('Admin auth (owner)', { tags: ['@smoke'] }, () => {
  it('redirects an unauthenticated visitor from a protected route to /login', () => {
    cy.visitAdmin('/');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/login');
    cy.get('[data-cy="login-submit"]').should('be.visible');
  });

  it('logs the owner in and shows their org + role on the dashboard', () => {
    cy.loginAdmin('owner');

    cy.location('pathname').should('eq', '/');
    cy.get('[data-cy="dashboard-welcome"]').should('contain.text', 'Sam Owner');
    cy.get('[data-cy="dashboard-org-line"]').should('contain.text', 'Sunrise Yoga Studio');
    cy.get('[data-cy="dashboard-role-badge"]').should('have.text', 'Owner');
    cy.get('[data-cy="signed-in-as"]').should('contain.text', 'Sam Owner');
  });

  it('lets the owner reach the Owner-only Organization page via nav', () => {
    cy.loginAdmin('owner');

    cy.get('[data-cy="nav-organization"]').should('be.visible').click();
    cy.location('pathname').should('eq', '/organization');
    cy.get('[data-cy="organization-heading"]').should('be.visible');
  });

  it('logging out sends the owner back to /login and re-protects the dashboard', () => {
    cy.loginAdmin('owner');
    cy.get('[data-cy="logout-button"]').click();

    cy.location('pathname').should('eq', '/login');

    cy.visitAdmin('/');
    cy.location('pathname').should('eq', '/login');
  });
});
