describe('Admin auth — negative cases', { tags: ['@smoke'] }, () => {
  it('shows an error and stays on /login for a wrong password', () => {
    cy.visitAdmin('/login');
    cy.get('[data-cy="login-email-input"]').type('owner@minbody.dev');
    cy.get('[data-cy="login-password-input"]').type('definitely-wrong');
    cy.get('[data-cy="login-submit"]').click();

    cy.get('[data-cy="login-error"]').should('be.visible').and('contain.text', 'Incorrect');
    cy.location('pathname').should('eq', '/login');
  });

  it('shows the dashboard with the Staff role for a staff login, with no Organization nav link', () => {
    cy.loginAdmin('staff');

    cy.get('[data-cy="dashboard-role-badge"]').should('have.text', 'Staff');
    cy.get('[data-cy="nav-organization"]').should('not.exist');
  });

  it('shows an access-denied view (not a redirect loop) when staff hits the Owner-only page directly', () => {
    cy.loginAdmin('staff');
    cy.location('pathname').should('eq', '/'); // wait for login to actually land before navigating away

    cy.visitAdmin('/organization');
    cy.get('[data-cy="access-denied"]').should('be.visible');
    cy.location('pathname').should('eq', '/organization');
  });
});
