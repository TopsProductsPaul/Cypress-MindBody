describe('Staff CRUD (owner)', { tags: ['@smoke'] }, () => {
  const runId = Date.now();
  const serviceName = `Staff Test Service ${runId}`;
  const staffName = `Jordan Trainer ${runId}`;
  const staffEmail = `jordan.trainer.${runId}@minbody.dev`;
  const staffPassword = 'Passw0rd!23';

  before(() => {
    // This spec needs a known service to assign — create one so the test doesn't depend on
    // leftover data from other specs (Postgres persists across local runs).
    cy.loginAdmin('owner');
    cy.location('pathname').should('eq', '/'); // wait for login to actually land before navigating away
    cy.visitAdmin('/services/new');
    cy.get('[data-cy="service-name-input"]').type(serviceName);
    cy.get('[data-cy="service-save-button"]').click();
    cy.location('pathname').should('eq', '/services');
  });

  beforeEach(() => {
    cy.loginAdmin('owner');
  });

  it('creates a staff account via the nav + form and shows it in the list', () => {
    cy.get('[data-cy="nav-staff"]').click();
    cy.location('pathname').should('eq', '/staff');

    cy.get('[data-cy="staff-new-link"]').click();
    cy.location('pathname').should('eq', '/staff/new');

    cy.get('[data-cy="staff-name-input"]').type(staffName);
    cy.get('[data-cy="staff-email-input"]').type(staffEmail);
    cy.get('[data-cy="staff-password-input"]').type(staffPassword);
    cy.get('[data-cy="staff-save-button"]').click();

    cy.location('pathname').should('eq', '/staff');
    cy.get('[data-cy="staff-table"]').should('contain.text', staffName);
    cy.contains('[data-cy="staff-row"]', staffName).should('contain.text', 'Staff');
  });

  it('assigns a qualified service and working hours, then removes the staff member', () => {
    cy.visitAdmin('/staff');
    cy.contains('[data-cy="staff-row"]', staffName).find('[data-cy="staff-edit-link"]').click();

    cy.contains('[data-cy="staff-qualified-service-row"]', serviceName)
      .find('input[type="checkbox"]')
      .check();

    cy.get('[data-cy="staff-day-enabled-Monday"]').check();
    cy.get('[data-cy="staff-day-start-Monday"]').invoke('val', '09:00').trigger('change');
    cy.get('[data-cy="staff-day-end-Monday"]').invoke('val', '17:00').trigger('change');

    cy.get('[data-cy="staff-save-button"]').click();
    cy.location('pathname').should('eq', '/staff');

    cy.contains('[data-cy="staff-row"]', staffName).within(() => {
      cy.get('td').eq(3).should('have.text', '1'); // qualified services
      cy.get('td').eq(4).should('have.text', '1'); // working days
    });

    cy.contains('[data-cy="staff-row"]', staffName).find('[data-cy="staff-edit-link"]').click();
    cy.get('[data-cy="staff-remove-button"]').click();
    cy.get('[data-cy="staff-remove-confirm-button"]').click();

    cy.location('pathname').should('eq', '/staff');
    cy.get('[data-cy="staff-table"]').should('not.contain.text', staffName);
  });
});

describe('Staff — negative cases', { tags: ['@smoke'] }, () => {
  it('does not show the Staff nav link to a staff account (Owner-only)', () => {
    cy.loginAdmin('staff');

    cy.get('[data-cy="nav-staff"]').should('not.exist');
  });
});
