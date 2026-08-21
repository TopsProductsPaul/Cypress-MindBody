describe('Audit log (owner)', { tags: ['@smoke'] }, () => {
  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('records a create, an update, and a delete for a service', () => {
    const serviceName = `Audit Log Service ${Date.now()}`;
    const updatedName = `${serviceName} (Updated)`;

    cy.visitAdmin('/services/new');
    cy.get('[data-cy="service-name-input"]').type(serviceName);
    cy.get('[data-cy="service-type-input"]').select('Class');
    cy.get('[data-cy="service-duration-input"]').clear().type('45');
    cy.get('[data-cy="service-capacity-input"]').clear().type('10');
    cy.get('[data-cy="service-credit-cost-input"]').clear().type('1');
    cy.get('[data-cy="service-save-button"]').click();
    cy.location('pathname').should('eq', '/services');

    cy.contains('[data-cy="services-row"]', serviceName).find('[data-cy="services-edit-link"]').click();
    cy.get('[data-cy="service-name-input"]').clear().type(updatedName);
    cy.get('[data-cy="service-save-button"]').click();
    cy.location('pathname').should('eq', '/services');

    cy.contains('[data-cy="services-row"]', updatedName).find('[data-cy="services-edit-link"]').click();
    cy.get('[data-cy="service-delete-button"]').click();
    cy.get('[data-cy="service-delete-confirm-button"]').click();
    cy.location('pathname').should('eq', '/services');

    cy.get('[data-cy="nav-audit-log"]').click();
    cy.location('pathname').should('eq', '/audit-log');

    // Newest first: the three actions just performed above are the most recent events in the
    // whole run, so they land in these exact rows regardless of what earlier specs logged.
    // (updatedName contains serviceName as a substring, so row order -- not text matching --
    // is what disambiguates "Created" from "Updated"/"Deleted" here.)
    cy.get('[data-cy="audit-log-table"]').should('be.visible');
    cy.get('[data-cy="audit-log-row"]').eq(0).should('contain.text', 'Deleted').and('contain.text', updatedName);
    cy.get('[data-cy="audit-log-row"]').eq(1).should('contain.text', 'Updated').and('contain.text', updatedName);
    cy.get('[data-cy="audit-log-row"]').eq(2).should('contain.text', 'Created').and('contain.text', serviceName);
  });
});

describe('Audit log — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Audit log nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');
    cy.get('[data-cy="nav-audit-log"]').should('not.exist');
  });

  it('rejects staff reads at the API boundary', () => {
    cy.loginAdmin('staff');
    cy.window().then((win) => {
      const token = win.localStorage.getItem('minbody.auth.token');
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiBaseUrl')}/audit-log`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).its('status').should('eq', 403);
    });
  });
});
