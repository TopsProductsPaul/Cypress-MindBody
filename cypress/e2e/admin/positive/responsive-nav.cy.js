describe('Responsive Admin nav (owner)', { tags: ['@smoke'] }, () => {
  it('shows nav links directly on desktop, with no hamburger toggle needed', () => {
    cy.viewport(1280, 800);
    cy.loginAdmin('owner');

    cy.get('[data-cy="nav-schedule"]').should('be.visible');
    cy.get('[data-cy="nav-toggle"]').should('not.be.visible');
  });

  it('collapses nav links behind a hamburger toggle on a mobile viewport, and closes on navigation', () => {
    cy.viewport(390, 844);
    cy.loginAdmin('owner');

    cy.get('[data-cy="nav-toggle"]').should('be.visible').and('have.attr', 'aria-expanded', 'false');
    cy.get('[data-cy="nav-schedule"]').should('not.be.visible');

    cy.get('[data-cy="nav-toggle"]').click();
    cy.get('[data-cy="nav-toggle"]').should('have.attr', 'aria-expanded', 'true');
    cy.get('[data-cy="nav-schedule"]').should('be.visible').click();

    cy.location('pathname').should('eq', '/schedule');
    cy.get('[data-cy="nav-schedule"]').should('not.be.visible');
  });
});
